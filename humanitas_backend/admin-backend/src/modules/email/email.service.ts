import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from '../settings/entities/settings.entity';

@Injectable()
export class EmailService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(PlatformSettings)
    private readonly settingsRepository: Repository<PlatformSettings>,
  ) { }

  async onModuleInit() {
    await this.ensureSettingsExist();
  }

  private async ensureSettingsExist(): Promise<void> {
    try {
      const existing = await this.settingsRepository.findOne({ where: {} });
      if (!existing) {
        console.log('📝 Creating default platform settings...');
        const defaultSettings = this.settingsRepository.create({
          platform_name: 'Humanitas',
          support_email: 'support@humanitas.com',
        });
        await this.settingsRepository.save(defaultSettings);
        console.log('✅ Default platform settings created');
      }
    } catch (error) {
      console.error('Failed to ensure settings exist:', error);
    }
  }

  private async getSettings(): Promise<PlatformSettings | null> {
    try {
      let settings = await this.settingsRepository.findOne({ where: {} });
      if (!settings) {
        settings = this.settingsRepository.create({
          platform_name: 'Humanitas',
          support_email: 'support@humanitas.com',
        });
        await this.settingsRepository.save(settings);
      }
      return settings;
    } catch (error) {
      console.error('Error getting settings:', error);
      return null;
    }
  }

  private async sendViaBrevoAPI(
    to: string,
    fromEmail: string,
    fromName: string,
    subject: string,
    htmlContent: string,
    textContent: string,
    apiKey: string,
  ): Promise<boolean> {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          htmlContent,
          textContent,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Email sent via Brevo API to ${to}, messageId: ${data.messageId}`);
        return true;
      } else {
        const error = await response.text();
        console.error(`❌ Brevo API error (${response.status}):`, error);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to send via Brevo API:', error.message);
      return false;
    }
  }

  async sendTenantWelcomeEmail(
    to: string,
    companyName: string,
    setupToken: string,
  ): Promise<boolean> {
    const settings = await this.getSettings();
    // [FIX] Use TENANT_FRONTEND_URL for tenant setup links (port 80 / 1300)
    const frontendUrl = this.configService.get<string>('TENANT_FRONTEND_URL', 'http://161.97.124.164');
    const setupLink = `${frontendUrl}/setup?token=${setupToken}`;
    const fromEmail = settings?.from_email || 'noreply@humanitas.com';
    const platformName = settings?.platform_name || 'Humanitas';

    console.log('📧 Email Configuration:');
    console.log(`   - To: ${to}`);
    console.log(`   - From: ${fromEmail}`);
    console.log(`   - Setup Link: ${setupLink}`);
    console.log(`   - SMTP Password (API Key): ${settings?.smtp_password ? '***SET***' : 'NOT SET'}`);

    const subject = `Welcome to ${platformName} - Complete Your Setup`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${platformName}!</h1>
          </div>
          <div class="content">
            <h2>Hello ${companyName},</h2>
            <p>Your organization has been successfully registered on our platform.</p>
            <p>To get started, please complete your initial setup by clicking the button below:</p>
            <p style="text-align: center;">
              <a href="${setupLink}" class="button">Complete Setup</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2563eb;">${setupLink}</p>
            <p><strong>This setup link will expire in 7 days.</strong></p>
            <p>During setup, you will:</p>
            <ul>
              <li>Create your admin account</li>
              <li>Set your password</li>
              <li>Configure initial settings</li>
            </ul>
            <p>If you have any questions, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${platformName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to ${platformName}!

Hello ${companyName},

Your organization has been successfully registered on our platform.

To get started, please complete your initial setup by visiting:
${setupLink}

This setup link will expire in 7 days.

If you have any questions, please contact our support team.
    `;

    // Use Brevo HTTP API (works on Render, unlike SMTP)
    // The smtp_password field stores the Brevo API key
    if (settings?.smtp_password) {
      console.log('🔄 Sending email via Brevo HTTP API...');
      const sent = await this.sendViaBrevoAPI(
        to,
        fromEmail,
        platformName,
        subject,
        html,
        text,
        settings.smtp_password,
      );

      if (sent) {
        return true;
      }
    }

    // Fallback: Log to console
    console.log('');
    console.log('='.repeat(60));
    console.log('⚠️  EMAIL NOT SENT - Configure Brevo API Key in Settings');
    console.log('='.repeat(60));
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Setup Link: ${setupLink}`);
    console.log('='.repeat(60));
    console.log('');
    console.log('To enable email sending:');
    console.log('1. Go to Admin Panel → Settings → Email Settings');
    console.log('2. Set "SMTP Password" to your Brevo API Key');
    console.log('3. Get API key from: https://app.brevo.com/settings/keys/api');
    console.log('');

    return false;
  }

  async sendPasswordResetEmail(
    to: string,
    resetToken: string,
    tenantSlug: string,
  ): Promise<boolean> {
    const settings = await this.getSettings();
    // [FIX] Use TENANT_FRONTEND_URL for password resets
    const frontendUrl = this.configService.get<string>('TENANT_FRONTEND_URL', 'http://161.97.124.164');
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&tenant=${tenantSlug}`;
    const fromEmail = settings?.from_email || 'noreply@humanitas.com';
    const platformName = settings?.platform_name || 'Humanitas';

    const subject = `${platformName} - Password Reset Request`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <p>You requested a password reset. Click the button below to reset your password:</p>
            <p style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2563eb;">${resetLink}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Reset your password: ${resetLink}`;

    if (settings?.smtp_password) {
      return await this.sendViaBrevoAPI(
        to,
        fromEmail,
        platformName,
        subject,
        html,
        text,
        settings.smtp_password,
      );
    }

    console.log('='.repeat(60));
    console.log('PASSWORD RESET EMAIL (API Key not configured):');
    console.log(`To: ${to}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log('='.repeat(60));
    return false;
  }

  async sendUserSetupEmail(
    to: string,
    userName: string,
    setupToken: string,
    tenantSlug: string,
    companyName: string,
  ): Promise<boolean> {
    const settings = await this.getSettings();
    const frontendUrl = this.configService.get<string>('TENANT_FRONTEND_URL', 'http://localhost:5174');
    const setupLink = `${frontendUrl}/${tenantSlug}/setup?token=${setupToken}&email=${encodeURIComponent(to)}`;
    const fromEmail = settings?.from_email || 'noreply@humanitas.com';
    const platformName = settings?.platform_name || 'Humanitas';

    const subject = `Welcome to ${companyName} - Set Up Your Account`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${companyName}!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>You have been added to ${companyName} on ${platformName}.</p>
            <p>Please click the button below to set up your account and create your password:</p>
            <p style="text-align: center;">
              <a href="${setupLink}" class="button">Set Up Account</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2563eb;">${setupLink}</p>
            <p><strong>This link will expire in 7 days.</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Welcome to ${companyName}! Set up your account: ${setupLink}`;

    if (settings?.smtp_password) {
      return await this.sendViaBrevoAPI(
        to,
        fromEmail,
        platformName,
        subject,
        html,
        text,
        settings.smtp_password,
      );
    }

    console.log('='.repeat(60));
    console.log('USER SETUP EMAIL (API Key not configured):');
    console.log(`To: ${to}`);
    console.log(`Setup Link: ${setupLink}`);
    console.log('='.repeat(60));
    return false;
  }
}
