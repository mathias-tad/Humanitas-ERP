import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { Tenant } from '../auth/entities/tenant.entity';
import {
  UpdateProfileDto,
  ChangePasswordDto,
  CreateUserDto,
  UpdateUserDto,
} from './dto/update-profile.dto';
import { SettingsService } from '../settings/settings.service';
import { v4 as uuidv4 } from 'uuid';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => SettingsService))
    private readonly settingsService: SettingsService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly notificationsGateway: NotificationsGateway,
  ) { }

  private async getTenantDatabaseName(tenantSlug: string): Promise<string> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantSlug}`);
    }
    return tenant.database_name;
  }

  private async ensureUserColumns(connection: any) {
    const columns = [
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id UUID',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_token VARCHAR(255)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_token_expires_at TIMESTAMP',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_password_set BOOLEAN DEFAULT false',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS nationality VARCHAR(100)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id VARCHAR(50)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(50)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50)',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS basic_salary DECIMAL(15,2) DEFAULT 0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS transport_allowance_percent DECIMAL(5,2) DEFAULT 0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS tin VARCHAR(50) DEFAULT NULL',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS account_number VARCHAR(50) DEFAULT NULL',
      // Overrides
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS desert_allowance_override VARCHAR(20) DEFAULT NULL',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS hardship_allowance_override VARCHAR(20) DEFAULT NULL',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS transport_allowance_override VARCHAR(20) DEFAULT NULL',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS per_diem_allowance_override VARCHAR(20) DEFAULT NULL',
    ];
    for (const sql of columns) {
      try {
        await connection.query(sql);
      } catch (e) { }
    }
  }

  async getProfile(userId: string, tenantSlug: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    await this.ensureUserColumns(connection);

    const result = await connection.query(
      `SELECT id, email, full_name, phone, role, department, position, avatar_url, is_active, 
              birth_date, address, city, state, country, postal_code, 
              gender, marital_status, nationality, national_id,
              emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
              hire_date, employment_type, basic_salary, employee_category_id, 
              tin, account_number,
              desert_allowance_percent, hardship_allowance_percent, transport_allowance_percent, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('User not found');
    }

    return result[0];
  }

  async updateProfile(
    userId: string,
    tenantSlug: string,
    dto: UpdateProfileDto,
  ) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    await this.ensureUserColumns(connection);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.full_name !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(dto.full_name);
    }
    if (dto.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(dto.email);
    }
    if (dto.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(dto.phone);
    }
    if (dto.department !== undefined) {
      updates.push(`department = $${paramIndex++}`);
      values.push(dto.department);
    }
    if (dto.position !== undefined) {
      updates.push(`position = $${paramIndex++}`);
      values.push(dto.position);
    }
    if (dto.birth_date !== undefined) {
      updates.push(`birth_date = $${paramIndex++}`);
      values.push(dto.birth_date);
    }
    // Address fields
    if (dto.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(dto.address);
    }
    if (dto.city !== undefined) {
      updates.push(`city = $${paramIndex++}`);
      values.push(dto.city);
    }
    if (dto.state !== undefined) {
      updates.push(`state = $${paramIndex++}`);
      values.push(dto.state);
    }
    if (dto.country !== undefined) {
      updates.push(`country = $${paramIndex++}`);
      values.push(dto.country);
    }
    if (dto.postal_code !== undefined) {
      updates.push(`postal_code = $${paramIndex++}`);
      values.push(dto.postal_code);
    }
    // Personal info
    if (dto.gender !== undefined) {
      updates.push(`gender = $${paramIndex++}`);
      values.push(dto.gender);
    }
    if (dto.marital_status !== undefined) {
      updates.push(`marital_status = $${paramIndex++}`);
      values.push(dto.marital_status);
    }
    if (dto.nationality !== undefined) {
      updates.push(`nationality = $${paramIndex++}`);
      values.push(dto.nationality);
    }
    if (dto.national_id !== undefined) {
      updates.push(`national_id = $${paramIndex++}`);
      values.push(dto.national_id);
    }
    // Emergency contact
    if (dto.emergency_contact_name !== undefined) {
      updates.push(`emergency_contact_name = $${paramIndex++}`);
      values.push(dto.emergency_contact_name);
    }
    if (dto.emergency_contact_phone !== undefined) {
      updates.push(`emergency_contact_phone = $${paramIndex++}`);
      values.push(dto.emergency_contact_phone);
    }
    if (dto.emergency_contact_relationship !== undefined) {
      updates.push(`emergency_contact_relationship = $${paramIndex++}`);
      values.push(dto.emergency_contact_relationship);
    }
    // Employment info
    if (dto.hire_date !== undefined) {
      updates.push(`hire_date = $${paramIndex++}`);
      values.push(dto.hire_date);
    }
    if (dto.employment_type !== undefined) {
      updates.push(`employment_type = $${paramIndex++}`);
      values.push(dto.employment_type);
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING id, email, full_name, phone, role, department, position, avatar_url, is_active,
                birth_date, address, city, state, country, postal_code,
                gender, marital_status, nationality, national_id,
                emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
                hire_date, employment_type, created_at, updated_at
    `;

    const result = await connection.query(query, values);
    return result[0];
  }

  async changePassword(
    userId: string,
    tenantSlug: string,
    dto: ChangePasswordDto,
  ) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    const userResult = await connection.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId],
    );

    if (!userResult || userResult.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = userResult[0];
    const isValidPassword = await bcrypt.compare(
      dto.current_password,
      user.password_hash,
    );

    if (!isValidPassword) {
      throw new BadRequestException('Current password is incorrect');
    }

    const saltRounds = Number(
      this.configService.get<number>('BCRYPT_SALT_ROUNDS', 12),
    );
    const newHash = await bcrypt.hash(dto.new_password, saltRounds);

    await connection.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, userId],
    );

    return { message: 'Password updated successfully' };
  }

  async uploadAvatar(userId: string, tenantSlug: string, file: any) {
    if (!file || !file.data) {
      throw new BadRequestException('No file uploaded');
    }

    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    // Get current avatar to delete old file
    const currentUser = await connection.query(
      `SELECT avatar_url FROM users WHERE id = $1`,
      [userId],
    );

    if (currentUser && currentUser.length > 0 && currentUser[0].avatar_url) {
      const oldPath = path.join(
        process.cwd(),
        'uploads',
        path.basename(currentUser[0].avatar_url),
      );
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          console.error('Failed to delete old avatar:', e);
        }
      }
    }

    // Generate unique filename
    const ext = path.extname(file.filename || '.png') || '.png';
    const filename = `${tenantSlug}_${userId}_${Date.now()}${ext}`;
    const uploadsDir = path.join(process.cwd(), 'uploads');

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const uploadPath = path.join(uploadsDir, filename);

    // Save file
    await fs.promises.writeFile(uploadPath, file.data);

    // Update database with relative URL
    const avatarUrl = `/uploads/${filename}`;

    const result = await connection.query(
      `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, email, full_name, phone, role, department, position, avatar_url, is_active, created_at, updated_at`,
      [avatarUrl, userId],
    );

    return result[0];
  }

  async deleteAvatar(userId: string, tenantSlug: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    const currentUser = await connection.query(
      `SELECT avatar_url FROM users WHERE id = $1`,
      [userId],
    );

    if (currentUser && currentUser.length > 0 && currentUser[0].avatar_url) {
      const oldPath = path.join(
        process.cwd(),
        'uploads',
        path.basename(currentUser[0].avatar_url),
      );
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          console.error('Failed to delete avatar:', e);
        }
      }
    }

    const result = await connection.query(
      `UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1
       RETURNING id, email, full_name, phone, role, department, position, avatar_url, is_active, created_at, updated_at`,
      [userId],
    );

    return result[0];
  }

  // User Management Methods
  async findAllUsers(tenantSlug: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    await this.ensureUserColumns(connection);

    // Ensure roles table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        permissions JSONB NOT NULL DEFAULT '[]',
        is_system BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await connection.query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.role_id, u.department, u.position,
              u.avatar_url, u.is_active, u.created_at, u.updated_at, u.last_login_at as last_login,
              r.name as role_name, u.is_password_set,
              u.birth_date, u.address, u.city, u.state, u.country, u.postal_code,
              u.gender, u.marital_status, u.nationality, u.national_id,
              u.emergency_contact_name, u.emergency_contact_phone, u.emergency_contact_relationship,
              u.hire_date, u.employment_type, u.basic_salary, u.employee_category_id,
              u.tin, u.account_number,
              u.desert_allowance_percent, u.hardship_allowance_percent, u.transport_allowance_percent
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`,
    );

    return result;
  }

  async getBasicUsers(tenantSlug: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    await this.ensureUserColumns(connection);

    const result = await connection.query(
      `SELECT u.id, u.email, u.full_name, u.avatar_url, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.is_active = true
       ORDER BY u.full_name ASC`,
    );

    return result;
  }

  async findUserById(tenantSlug: string, userId: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    await this.ensureUserColumns(connection);

    const result = await connection.query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.role_id, u.department, u.position, 
              u.avatar_url, u.is_active, u.created_at, u.updated_at, u.last_login_at as last_login,
              r.name as role_name, u.is_password_set,
              u.birth_date, u.address, u.city, u.state, u.country, u.postal_code,
              u.gender, u.marital_status, u.nationality, u.national_id,
              u.emergency_contact_name, u.emergency_contact_phone, u.emergency_contact_relationship,
              u.hire_date, u.employment_type, u.basic_salary, u.employee_category_id,
              u.desert_allowance_percent, u.hardship_allowance_percent, u.transport_allowance_percent
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = result[0];

    // Fetch user allowance settings (Generic Tiers)
    try {
      const settings = await connection.query(
        `SELECT income_type_id, tier, custom_amount FROM user_allowance_settings WHERE user_id = $1`,
        [userId]
      );
      user.allowance_settings = settings || [];
    } catch (e) {
      user.allowance_settings = [];
    }

    return user;
  }

  private async sendViaBrevoAPI(
    apiKey: string,
    from: { name: string; email: string },
    to: string,
    subject: string,
    htmlContent: string,
  ): Promise<boolean> {
    try {
      console.log('[BrevoAPI] Sending email via Brevo HTTP API...');
      console.log('[BrevoAPI] To:', to, 'Subject:', subject);

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          sender: from,
          to: [{ email: to }],
          subject,
          htmlContent,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BrevoAPI] Failed:', response.status, errorText);
        return false;
      }

      const result = await response.json();
      console.log('[BrevoAPI] Success! MessageId:', result.messageId);
      return true;
    } catch (error) {
      console.error('[BrevoAPI] Error:', error.message);
      return false;
    }
  }

  async sendWelcomeEmail(tenantSlug: string, user: any, setupToken: string) {
    try {
      console.log(
        `[WelcomeEmail] ========== STARTING EMAIL PROCESS ==========`,
      );
      console.log(
        `[WelcomeEmail] Tenant: ${tenantSlug}, User email: ${user.email}`,
      );

      const settings = await this.settingsService.getEmailSettings(tenantSlug);

      // Check for Brevo API key (stored in smtp_pass or brevo_api_key field)
      const brevoApiKey = settings?.brevo_api_key || settings?.smtp_pass;

      console.log('[WelcomeEmail] Settings check:', {
        hasSettings: !!settings,
        hasBrevoKey: !!brevoApiKey && brevoApiKey.length > 10,
        fromEmail: settings?.from_email || '(not set)',
      });

      if (!brevoApiKey || brevoApiKey.length < 10) {
        console.warn('[WelcomeEmail] SKIPPED - Brevo API key not configured');
        return;
      }

      const setupLink = `${process.env.FRONTEND_URL || 'http://localhost:1300'}/setup-account?token=${setupToken}&email=${user.email}&tenant=${tenantSlug}`;

      const companySettings =
        await this.settingsService.getCompanySettings(tenantSlug);
      const companyName =
        companySettings?.company_name ||
        settings.from_name ||
        'Humanitas System';
      const fromEmail = settings.from_email || 'noreply@humanitas.com';

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome, ${user.full_name}!</h2>
          <p>An account has been created for you in the ${companyName} system.</p>
          <p>Please click the link below to set up your password and access your account:</p>
          <p>
            <a href="${setupLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Set Up Account
            </a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <p>${setupLink}</p>
          <p>This link will expire in 7 days.</p>
          <p>Best regards,<br>${companyName}</p>
        </div>
      `;

      const success = await this.sendViaBrevoAPI(
        brevoApiKey,
        { name: companyName, email: fromEmail },
        user.email,
        `Welcome to ${companyName} - Setup Your Account`,
        htmlContent,
      );

      if (success) {
        console.log(`[WelcomeEmail] SUCCESS! Email sent to ${user.email}`);
      } else {
        console.warn(`[WelcomeEmail] Failed to send email to ${user.email}`);
      }
    } catch (error) {
      console.error(
        '[WelcomeEmail] FAILED to send welcome email:',
        error.message,
      );
      // Don't throw error to prevent blocking user creation
    }
  }

  async sendAccountNotification(
    tenantSlug: string,
    user: any,
    type: 'suspended' | 'activated' | 'role_changed',
    details?: string,
  ) {
    try {
      const settings = await this.settingsService.getEmailSettings(tenantSlug);
      const brevoApiKey = settings?.brevo_api_key || settings?.smtp_pass;

      if (!brevoApiKey || brevoApiKey.length < 10) {
        return;
      }

      let subject = '';
      let message = '';
      const companySettings =
        await this.settingsService.getCompanySettings(tenantSlug);
      const companyName =
        companySettings?.company_name ||
        settings.from_name ||
        'Humanitas System';
      const fromEmail = settings.from_email || 'noreply@humanitas.com';

      switch (type) {
        case 'suspended':
          subject = 'Account Suspended';
          message =
            '<p>Your account has been suspended. Please contact your administrator for more information.</p>';
          break;
        case 'activated':
          subject = 'Account Activated';
          message =
            '<p>Your account has been reactivated. You can now log in to the system.</p>';
          break;
        case 'role_changed':
          subject = 'Role Updated';
          message = `<p>Your role has been updated to: <strong>${details}</strong>.</p>`;
          break;
      }

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${user.full_name},</h2>
          ${message}
          <p>Best regards,<br>${companyName}</p>
        </div>
      `;

      await this.sendViaBrevoAPI(
        brevoApiKey,
        { name: companyName, email: fromEmail },
        user.email,
        `${companyName} - ${subject}`,
        htmlContent,
      );
    } catch (error) {
      console.error('Failed to send notification email:', error);
    }
  }

  async createUser(tenantSlug: string, dto: CreateUserDto) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    await this.ensureUserColumns(connection);

    // Check if email already exists
    const existingUser = await connection.query(
      `SELECT id FROM users WHERE email = $1`,
      [dto.email],
    );

    if (existingUser && existingUser.length > 0) {
      throw new BadRequestException('Email already exists');
    }

    // If password is provided, hash it. Otherwise generate setup token.
    let passwordHash: string | null = null;
    let setupToken: string | null = null;
    let setupTokenExpires: Date | null = null;
    let isPasswordSet = false;

    if (dto.password && dto.password.trim().length > 0) {
      const saltRounds = Number(
        this.configService.get<number>('BCRYPT_SALT_ROUNDS', 12),
      );
      passwordHash = await bcrypt.hash(dto.password, saltRounds);
      isPasswordSet = true;
    } else {
      setupToken = uuidv4();
      setupTokenExpires = new Date();
      if (setupTokenExpires) {
        setupTokenExpires.setDate(setupTokenExpires.getDate() + 7); // 7 days expiry
      }
    }

    // Handle empty role_id
    const roleId =
      dto.role_id && dto.role_id.trim() !== '' ? dto.role_id : null;

    try {
      const result = await connection.query(
        `INSERT INTO users (
          email, password_hash, full_name, phone, role_id, department, position, 
          is_active, setup_token, setup_token_expires_at, is_password_set,
          birth_date, address, city, state, country, postal_code,
          gender, marital_status, nationality, national_id,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
          hire_date, employment_type, basic_salary, employee_category_id,
          tin, account_number,
          desert_allowance_percent, hardship_allowance_percent, transport_allowance_percent
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
         RETURNING id, email, full_name, phone, role_id, department, position, avatar_url, is_active, 
                   birth_date, address, city, state, country, postal_code,
                   gender, marital_status, nationality, national_id,
                   emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
                   hire_date, employment_type, basic_salary, employee_category_id,
                   tin, account_number,
                   desert_allowance_percent, hardship_allowance_percent, transport_allowance_percent, created_at, updated_at`,
        [
          dto.email,
          passwordHash,
          dto.full_name,
          dto.phone || null,
          roleId,
          dto.department || null,
          dto.position || null,
          setupToken,
          setupTokenExpires,
          isPasswordSet,
          dto.birth_date || null,
          dto.address || null,
          dto.city || null,
          dto.state || null,
          dto.country || null,
          dto.postal_code || null,
          dto.gender || null,
          dto.marital_status || null,
          dto.nationality || null,
          dto.national_id || null,
          dto.emergency_contact_name || null,
          dto.emergency_contact_phone || null,
          dto.emergency_contact_relationship || null,
          dto.hire_date || null,
          dto.employment_type || null,
          dto.basic_salary || 0,
          dto.employee_category_id || null,
          dto.tin || null,
          dto.account_number || null,
          dto.desert_allowance_percent || 0,
          dto.hardship_allowance_percent || 0,
          dto.transport_allowance_percent || 0,
        ],
      );

      const newUser = result[0];

      // Save allowance settings if provided
      if (dto.allowance_settings && dto.allowance_settings.length > 0) {
        for (const setting of dto.allowance_settings) {
          try {
            await connection.query(
              `INSERT INTO user_allowance_settings (user_id, income_type_id, tier, custom_amount)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id, income_type_id) DO UPDATE 
               SET tier = EXCLUDED.tier, custom_amount = EXCLUDED.custom_amount, updated_at = NOW()`,
              [newUser.id, setting.income_type_id, setting.tier || 'min', setting.custom_amount || 0]
            );
          } catch (e) {
            console.error('Failed to save allowance setting:', e);
          }
        }
      }

      // Send welcome email if setup token was generated
      if (setupToken) {
        console.log(
          '[CreateUser] Setup token generated, sending welcome email...',
        );
        await this.sendWelcomeEmail(tenantSlug, newUser, setupToken);
      } else {
        console.log('[CreateUser] Password provided, skipping welcome email');
      }

      return newUser;
    } catch (error) {
      console.error('Create user error:', error);
      throw new BadRequestException(`Failed to create user: ${error.message}`);
    }
  }

  async updateUser(tenantSlug: string, userId: string, dto: UpdateUserDto) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    await this.ensureUserColumns(connection);

    // Get current user state before update to check for changes
    const currentUser = await this.findUserById(tenantSlug, userId);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.full_name !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(dto.full_name);
    }
    if (dto.email !== undefined) {
      // Check if email is taken by another user
      const existing = await connection.query(
        `SELECT id FROM users WHERE email = $1 AND id != $2`,
        [dto.email, userId],
      );
      if (existing && existing.length > 0) {
        throw new BadRequestException('Email already exists');
      }
      updates.push(`email = $${paramIndex++}`);
      values.push(dto.email);
    }
    if (dto.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(dto.phone);
    }
    if (dto.role_id !== undefined) {
      updates.push(`role_id = $${paramIndex++}`);
      values.push(dto.role_id);
    }
    if (dto.department !== undefined) {
      updates.push(`department = $${paramIndex++}`);
      values.push(dto.department);
    }
    if (dto.position !== undefined) {
      updates.push(`position = $${paramIndex++}`);
      values.push(dto.position);
    }
    if (dto.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(dto.is_active);
    }
    if (dto.password !== undefined && dto.password.trim().length > 0) {
      const saltRounds = Number(
        this.configService.get<number>('BCRYPT_SALT_ROUNDS', 12),
      );
      const passwordHash = await bcrypt.hash(dto.password, saltRounds);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);

      updates.push(`is_password_set = $${paramIndex++}`);
      values.push(true);
    }
    // Address fields
    if (dto.birth_date !== undefined) {
      updates.push(`birth_date = $${paramIndex++}`);
      values.push(dto.birth_date);
    }
    if (dto.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(dto.address);
    }
    if (dto.city !== undefined) {
      updates.push(`city = $${paramIndex++}`);
      values.push(dto.city);
    }
    if (dto.state !== undefined) {
      updates.push(`state = $${paramIndex++}`);
      values.push(dto.state);
    }
    if (dto.country !== undefined) {
      updates.push(`country = $${paramIndex++}`);
      values.push(dto.country);
    }
    if (dto.postal_code !== undefined) {
      updates.push(`postal_code = $${paramIndex++}`);
      values.push(dto.postal_code);
    }
    // Personal info
    if (dto.gender !== undefined) {
      updates.push(`gender = $${paramIndex++}`);
      values.push(dto.gender);
    }
    if (dto.marital_status !== undefined) {
      updates.push(`marital_status = $${paramIndex++}`);
      values.push(dto.marital_status);
    }
    if (dto.nationality !== undefined) {
      updates.push(`nationality = $${paramIndex++}`);
      values.push(dto.nationality);
    }
    if (dto.national_id !== undefined) {
      updates.push(`national_id = $${paramIndex++}`);
      values.push(dto.national_id);
    }
    // Emergency contact
    if (dto.emergency_contact_name !== undefined) {
      updates.push(`emergency_contact_name = $${paramIndex++}`);
      values.push(dto.emergency_contact_name);
    }
    if (dto.emergency_contact_phone !== undefined) {
      updates.push(`emergency_contact_phone = $${paramIndex++}`);
      values.push(dto.emergency_contact_phone);
    }
    if (dto.emergency_contact_relationship !== undefined) {
      updates.push(`emergency_contact_relationship = $${paramIndex++}`);
      values.push(dto.emergency_contact_relationship);
    }
    // Employment info
    if (dto.hire_date !== undefined) {
      updates.push(`hire_date = $${paramIndex++}`);
      values.push(dto.hire_date);
    }
    if (dto.employment_type !== undefined) {
      updates.push(`employment_type = $${paramIndex++}`);
      values.push(dto.employment_type);
    }
    if (dto.basic_salary !== undefined) {
      updates.push(`basic_salary = $${paramIndex++}`);
      values.push(dto.basic_salary);
    }
    if (dto.tin !== undefined) {
      updates.push(`tin = $${paramIndex++}`);
      values.push(dto.tin);
    }
    if (dto.account_number !== undefined) {
      updates.push(`account_number = $${paramIndex++}`);
      values.push(dto.account_number);
    }
    if (dto.employee_category_id !== undefined) {
      updates.push(`employee_category_id = $${paramIndex++}`);
      values.push(dto.employee_category_id);
    }
    if (dto.desert_allowance_percent !== undefined) {
      updates.push(`desert_allowance_percent = $${paramIndex++}`);
      values.push(dto.desert_allowance_percent);
    }
    if (dto.hardship_allowance_percent !== undefined) {
      updates.push(`hardship_allowance_percent = $${paramIndex++}`);
      values.push(dto.hardship_allowance_percent);
    }
    if (dto.transport_allowance_percent !== undefined) {
      updates.push(`transport_allowance_percent = $${paramIndex++}`);
      values.push(dto.transport_allowance_percent);
    }

    if (updates.length === 0) {
      return this.findUserById(tenantSlug, userId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await connection.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, full_name, phone, role_id, department, position, avatar_url, is_active,
                 birth_date, address, city, state, country, postal_code,
                 gender, marital_status, nationality, national_id,
                 emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
                 hire_date, employment_type, basic_salary, employee_category_id,
                 tin, account_number,
                 desert_allowance_percent, hardship_allowance_percent, transport_allowance_percent, created_at, updated_at`,
      values,
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = result[0];

    // Handle User Allowance Settings (Tiers)
    if (dto.allowance_settings && Array.isArray(dto.allowance_settings)) {
      await connection.query(
        `DELETE FROM user_allowance_settings WHERE user_id = $1`,
        [userId],
      );

      for (const setting of dto.allowance_settings) {
        if (setting.income_type_id) {
          await connection.query(
            `INSERT INTO user_allowance_settings (user_id, income_type_id, tier, custom_amount) 
             VALUES ($1, $2, $3, $4)`,
            [
              userId,
              setting.income_type_id,
              setting.tier || 'none',
              setting.custom_amount || 0,
            ],
          );
        }
      }
    }

    // Send notifications based on changes
    if (
      dto.is_active !== undefined &&
      dto.is_active !== currentUser.is_active
    ) {
      this.sendAccountNotification(
        tenantSlug,
        updatedUser,
        dto.is_active ? 'activated' : 'suspended',
      );
    }

    if (dto.role_id !== undefined && dto.role_id !== currentUser.role_id) {
      // Fetch new role name
      const roleResult = await connection.query(
        `SELECT name FROM roles WHERE id = $1`,
        [dto.role_id],
      );
      if (roleResult && roleResult.length > 0) {
        this.sendAccountNotification(
          tenantSlug,
          updatedUser,
          'role_changed',
          roleResult[0].name,
        );
      }
    }

    // Send in-app notification for profile updates
    try {
      // Determine what changed
      const changedFields: string[] = [];
      if (dto.full_name !== undefined && dto.full_name !== currentUser.full_name) changedFields.push('name');
      if (dto.email !== undefined && dto.email !== currentUser.email) changedFields.push('email');
      if (dto.phone !== undefined && dto.phone !== currentUser.phone) changedFields.push('phone');
      if (dto.department !== undefined && dto.department !== currentUser.department) changedFields.push('department');
      if (dto.position !== undefined && dto.position !== currentUser.position) changedFields.push('position');
      if (dto.role_id !== undefined && dto.role_id !== currentUser.role_id) changedFields.push('role');
      if (dto.is_active !== undefined && dto.is_active !== currentUser.is_active) changedFields.push('account status');
      if (dto.basic_salary !== undefined && dto.basic_salary !== currentUser.basic_salary) changedFields.push('salary');
      if (dto.birth_date !== undefined) changedFields.push('birth date');
      if (dto.address !== undefined) changedFields.push('address');
      if (dto.emergency_contact_name !== undefined) changedFields.push('emergency contact');
      if (dto.hire_date !== undefined) changedFields.push('hire date');
      if (dto.employment_type !== undefined) changedFields.push('employment type');

      if (changedFields.length > 0) {
        // Get tenant info to query for who made the change
        const tenant = await this.tenantRepository.findOne({ where: { slug: tenantSlug } });

        const fieldsList = changedFields.length <= 3
          ? changedFields.join(', ')
          : `${changedFields.slice(0, 3).join(', ')} and ${changedFields.length - 3} more`;

        const notification = await this.notificationsService.createNotification(
          tenant?.id || tenantSlug,
          userId,
          {
            type: 'profile_update',
            referenceId: userId,
            title: 'Profile Updated',
            message: `Your profile has been updated. Changed: ${fieldsList}.`
          }
        );

        this.notificationsGateway.pushToUser(tenant?.id || tenantSlug, userId, notification);
      }
    } catch (notifError) {
      console.error('[UsersService] Failed to send profile update notification:', notifError);
    }

    return this.findUserById(tenantSlug, userId);
  }

  async deleteUser(
    tenantSlug: string,
    userId: string,
    permanent: boolean = false,
  ) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    let result;
    if (permanent) {
      // Permanent delete
      result = await connection.query(
        `DELETE FROM users WHERE id = $1 RETURNING id`,
        [userId],
      );
    } else {
      // Soft delete - set is_active to false
      result = await connection.query(
        `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
        [userId],
      );
    }

    if (!result || result.length === 0) {
      throw new NotFoundException('User not found');
    }

    return {
      message: permanent
        ? 'User permanently deleted'
        : 'User suspended successfully',
    };
  }

  async getUserPermissions(tenantSlug: string, userId: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    const result = await connection.query(
      `SELECT r.permissions FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId],
    );

    if (!result || result.length === 0) {
      return [];
    }

    return result[0].permissions || [];
  }

  // User Attachments Methods
  private async ensureAttachmentsTable(connection: any) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'other',
        description TEXT,
        uploaded_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async getUserAttachments(tenantSlug: string, userId: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    await this.ensureAttachmentsTable(connection);

    const result = await connection.query(
      `SELECT a.*, u.full_name as uploaded_by_name
       FROM user_attachments a
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC`,
      [userId],
    );

    return result;
  }

  async uploadUserAttachment(
    tenantSlug: string,
    targetUserId: string,
    uploadedByUserId: string,
    file: any,
    category: string = 'other',
    description?: string,
  ) {
    if (!file || !file.data) {
      throw new BadRequestException('No file uploaded');
    }

    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    await this.ensureAttachmentsTable(connection);

    // Generate unique filename
    const ext = path.extname(file.filename || '.pdf') || '.pdf';
    const filename = `${tenantSlug}_${targetUserId}_${Date.now()}_${uuidv4()}${ext}`;
    const uploadsDir = path.join(process.cwd(), 'uploads', 'attachments');

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const uploadPath = path.join(uploadsDir, filename);

    // Save file
    await fs.promises.writeFile(uploadPath, file.data);

    // Store relative path
    const filePath = `/uploads/attachments/${filename}`;

    const result = await connection.query(
      `INSERT INTO user_attachments (user_id, file_name, original_name, file_type, file_size, file_path, category, description, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        targetUserId,
        filename,
        file.filename,
        file.mimetype,
        file.data.length,
        filePath,
        category,
        description || null,
        uploadedByUserId,
      ],
    );

    return result[0];
  }

  async deleteUserAttachment(tenantSlug: string, attachmentId: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    // Get attachment to delete file
    const attachment = await connection.query(
      `SELECT * FROM user_attachments WHERE id = $1`,
      [attachmentId],
    );

    if (!attachment || attachment.length === 0) {
      throw new NotFoundException('Attachment not found');
    }

    // Delete physical file
    const filePath = path.join(
      process.cwd(),
      attachment[0].file_path.replace(/^\//, ''),
    );
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('Failed to delete attachment file:', e);
      }
    }

    // Delete from database
    await connection.query(`DELETE FROM user_attachments WHERE id = $1`, [
      attachmentId,
    ]);

    return { message: 'Attachment deleted successfully' };
  }

  async getAttachmentById(tenantSlug: string, attachmentId: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);

    const result = await connection.query(
      `SELECT * FROM user_attachments WHERE id = $1`,
      [attachmentId],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Attachment not found');
    }

    return result[0];
  }

  /**
   * Calculate effective allowances for a user based on category defaults and user overrides
   */
  async getUserEffectiveAllowances(tenantSlug: string, userId: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);

    // Fetch user with override columns
    const userResult = await connection.query(
      `SELECT 
        employee_category_id, 
        desert_allowance_percent, desert_allowance_override,
        hardship_allowance_percent, hardship_allowance_override,
        transport_allowance_override, per_diem_allowance_override
      FROM users WHERE id = $1`,
      [userId]
    );

    if (!userResult || userResult.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = userResult[0];
    let category: any = null;

    // Fetch employee category if assigned
    if (user.employee_category_id) {
      const categoryResult = await connection.query(
        `SELECT * FROM employee_categories WHERE id = $1`,
        [user.employee_category_id]
      );
      if (categoryResult && categoryResult.length > 0) {
        category = categoryResult[0];
      }
    }

    // Helper function to calculate percentage for an allowance type
    const calculateAllowance = (type: string) => {
      const override = user[`${type}_allowance_override`];
      const customPercent = user[`${type}_allowance_percent`];

      // If user has custom override with specific percentage
      if (override === 'custom' && customPercent !== null && customPercent !== undefined) {
        return {
          source: 'override',
          tier: 'custom',
          percentage: customPercent,
          categoryTiers: category ? {
            min: category[`${type}_min_percent`] || 0,
            mid: category[`${type}_mid_percent`] || 0,
            max: category[`${type}_max_percent`] || 0,
            default: category[`${type}_default_tier`] || 'none',
          } : null,
        };
      }

      // If user has tier override (min/mid/max)
      if (override && override !== 'custom' && override !== 'none') {
        return {
          source: 'override',
          tier: override,
          percentage: category ? (category[`${type}_${override}_percent`] || 0) : 0,
          categoryTiers: category ? {
            min: category[`${type}_min_percent`] || 0,
            mid: category[`${type}_mid_percent`] || 0,
            max: category[`${type}_max_percent`] || 0,
            default: category[`${type}_default_tier`] || 'none',
          } : null,
        };
      }

      // Use category default
      const defaultTier = category ? category[`${type}_default_tier`] : 'none';
      const defaultPercent = (category && defaultTier !== 'none')
        ? (category[`${type}_${defaultTier}_percent`] || 0)
        : 0;

      return {
        source: 'category',
        tier: defaultTier,
        percentage: defaultPercent,
        categoryTiers: category ? {
          min: category[`${type}_min_percent`] || 0,
          mid: category[`${type}_mid_percent`] || 0,
          max: category[`${type}_max_percent`] || 0,
          default: category[`${type}_default_tier`] || 'none',
        } : null,
      };
    };

    return {
      desert: calculateAllowance('desert'),
      hardship: calculateAllowance('hardship'),
      transport: calculateAllowance('transport'),
      per_diem: calculateAllowance('per_diem'),
      hasCategory: !!category,
      categoryName: category?.name || null,
    };
  }

  /**
   * Set or update a user's allowance override
   */
  async setAllowanceOverride(
    tenantSlug: string,
    userId: string,
    dto: { type: string; tier: string; customPercent?: number }
  ) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);

    const { type, tier, customPercent } = dto;

    // Validate type
    const validTypes = ['desert', 'hardship', 'transport', 'per_diem'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid allowance type: ${type}`);
    }

    // Validate tier
    const validTiers = ['none', 'min', 'mid', 'max', 'custom', 'category'];
    if (!validTiers.includes(tier)) {
      throw new Error(`Invalid tier: ${tier}`);
    }

    // Build update query
    const overrideColumn = `${type}_allowance_override`;
    const percentColumn = `${type}_allowance_percent`;

    let updateQuery = '';
    let values: any[] = [];

    if (tier === 'category' || tier === 'none') {
      // Reset to category default
      updateQuery = `UPDATE users SET ${overrideColumn} = NULL, ${percentColumn} = NULL WHERE id = $1`;
      values = [userId];
    } else if (tier === 'custom') {
      // Custom percentage
      if (customPercent === undefined || customPercent === null) {
        throw new Error('Custom percentage required for custom tier');
      }
      updateQuery = `UPDATE users SET ${overrideColumn} = $1, ${percentColumn} = $2 WHERE id = $3`;
      values = ['custom', customPercent, userId];
    } else {
      // Specific tier (min/mid/max)
      updateQuery = `UPDATE users SET ${overrideColumn} = $1, ${percentColumn} = NULL WHERE id = $2`;
      values = [tier, userId];
    }

    await connection.query(updateQuery, values);

    return { message: 'Allowance override updated successfully' };
  }

  private async ensureCategoryAllowanceColumns(connection: any) {
    const queries = [
      "ALTER TABLE category_allowances ADD COLUMN IF NOT EXISTS min_amount DECIMAL(10,2) DEFAULT 0",
      "ALTER TABLE category_allowances ADD COLUMN IF NOT EXISTS mid_amount DECIMAL(10,2) DEFAULT 0",
      "ALTER TABLE category_allowances ADD COLUMN IF NOT EXISTS max_amount DECIMAL(10,2) DEFAULT 0",
      "ALTER TABLE category_allowances ADD COLUMN IF NOT EXISTS default_tier VARCHAR(20) DEFAULT 'none'",
      `CREATE TABLE IF NOT EXISTS user_allowance_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL, 
          income_type_id UUID NOT NULL, 
          tier VARCHAR(20), 
          custom_amount DECIMAL(10,2), 
          created_at TIMESTAMP DEFAULT NOW(), 
          updated_at TIMESTAMP DEFAULT NOW()
       )`
    ];
    for (const q of queries) { try { await connection.query(q); } catch (e) { } }
  }

  /**
   * Get all allowances assigned to a specific employee category
   */
  async getCategoryAllowances(tenantSlug: string, categoryId: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);

    await this.ensureCategoryAllowanceColumns(connection);

    const result = await connection.query(`
      SELECT ca.id, ca.amount, ca.min_amount, ca.mid_amount, ca.max_amount, ca.default_tier, ca.is_active,
             it.id as income_type_id, it.name as income_type_name, 
             it.calculation_type, it.is_taxable, it.is_pensionable
      FROM category_allowances ca
      JOIN income_types it ON ca.income_type_id = it.id
      WHERE ca.employee_category_id = $1
      ORDER BY it.name ASC
    `, [categoryId]);

    return result;
  }

  /**
   * Add a new allowance to an employee category
   */
  async addCategoryAllowance(
    tenantSlug: string,
    categoryId: string,
    dto: {
      income_type_id: string;
      amount?: number;
      min_amount?: number;
      mid_amount?: number;
      max_amount?: number;
      default_tier?: string;
    }
  ) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);

    await this.ensureCategoryAllowanceColumns(connection);

    // Check if this allowance already exists for this category
    const existing = await connection.query(`
      SELECT id FROM category_allowances 
      WHERE employee_category_id = $1 AND income_type_id = $2
    `, [categoryId, dto.income_type_id]);

    if (existing && existing.length > 0) {
      throw new BadRequestException('This income type is already assigned to this category');
    }

    const result = await connection.query(`
      INSERT INTO category_allowances (
        employee_category_id, income_type_id, amount, 
        min_amount, mid_amount, max_amount, default_tier, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING id, employee_category_id, income_type_id, amount, min_amount, mid_amount, max_amount, default_tier, is_active
    `, [
      categoryId,
      dto.income_type_id,
      dto.amount || 0,
      dto.min_amount || 0,
      dto.mid_amount || 0,
      dto.max_amount || 0,
      dto.default_tier || 'none'
    ]);

    return result[0];
  }

  /**
   * Delete a category allowance
   */
  async deleteCategoryAllowance(
    tenantSlug: string,
    allowanceId: string
  ) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);

    const result = await connection.query(`
      DELETE FROM category_allowances WHERE id = $1 RETURNING id
    `, [allowanceId]);

    if (!result || result.length === 0) {
      throw new NotFoundException('Category allowance not found');
    }

    return { message: 'Category allowance deleted successfully' };
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(tenantSlug: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);

    // Active Users
    const usersResult = await connection.query(
      `SELECT COUNT(*) as count FROM users WHERE is_active = true`
    );
    const activeUsers = parseInt(usersResult[0].count);

    // New Hires This Month
    const hireResult = await connection.query(
      `SELECT COUNT(*) as count FROM users 
       WHERE EXTRACT(MONTH FROM hire_date) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM hire_date) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );
    const newHires = parseInt(hireResult[0].count);

    // Attendance Today
    let attendanceToday = 0;
    try {
      const attResult = await connection.query(
        `SELECT COUNT(DISTINCT user_id) as count FROM attendance_records WHERE date = CURRENT_DATE`
      );
      attendanceToday = parseInt(attResult[0].count);
    } catch (e) {
      // Table might not exist yet
    }

    // Leaves Pending
    let leavesPending = 0;
    try {
      const leaveResult = await connection.query(
        `SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'`
      );
      leavesPending = parseInt(leaveResult[0].count);
    } catch (e) {
      // Table might not exist yet
    }

    return {
      activeUsers,
      attendanceToday,
      leavesPending,
      newHires
    };
  }

  /**
   * Get comprehensive home dashboard data
   */
  async getHomeDashboardData(tenantSlug: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection = await this.databaseService.getTenantConnection(databaseName);

    // HR Metrics
    const totalEmployees = await connection.query(
      `SELECT COUNT(*) as count FROM users WHERE is_active = true`
    );
    const activeEmployees = parseInt(totalEmployees[0].count);

    const newHires = await connection.query(
      `SELECT COUNT(*) as count FROM users 
       WHERE DATE(created_at) >= DATE_TRUNC('month', CURRENT_DATE)`
    );

    let pendingLeaves = 0;
    try {
      const leaves = await connection.query(
        `SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'`
      );
      pendingLeaves = parseInt(leaves[0].count);
    } catch (e) { }

    // Today's Attendance
    let attendanceToday = { present: 0, absent: 0, late: 0 };
    try {
      const present = await connection.query(
        `SELECT COUNT(DISTINCT user_id) as count FROM attendance_records WHERE date = CURRENT_DATE`
      );
      attendanceToday.present = parseInt(present[0].count);

      attendanceToday.absent = activeEmployees - attendanceToday.present;

      // Count late arrivals
      const late = await connection.query(
        `SELECT COUNT(*) as count FROM attendance_records 
         WHERE date = CURRENT_DATE AND is_late = true`
      );
      attendanceToday.late = parseInt(late[0]?.count || 0);
    } catch (e) { }

    const attendanceRate = activeEmployees > 0
      ? ((attendanceToday.present / activeEmployees) * 100).toFixed(1)
      : 0;

    // PMS Metrics (if tables exist)
    let pmsMetrics = {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      overdueTasks: 0,
      completionRate: 0
    };

    try {
      const tasks = await connection.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status != 'completed' AND due_date < CURRENT_DATE THEN 1 END) as overdue
        FROM tasks
      `);

      if (tasks && tasks.length > 0) {
        pmsMetrics.totalTasks = parseInt(tasks[0].total);
        pmsMetrics.completedTasks = parseInt(tasks[0].completed);
        pmsMetrics.inProgressTasks = parseInt(tasks[0].in_progress);
        pmsMetrics.overdueTasks = parseInt(tasks[0].overdue);
        pmsMetrics.completionRate = pmsMetrics.totalTasks > 0
          ? parseFloat(((pmsMetrics.completedTasks / pmsMetrics.totalTasks) * 100).toFixed(1))
          : 0;
      }
    } catch (e) { }

    // Payroll Metrics
    let payrollMetrics = {
      monthlyPayroll: 0,
      processed: 0,
      pending: 0
    };

    try {
      const payroll = await connection.query(`
        SELECT 
          SUM(net_salary) as total,
          COUNT(*) as processed
        FROM payroll_items
        WHERE month = EXTRACT(MONTH FROM CURRENT_DATE)
        AND year = EXTRACT(YEAR FROM CURRENT_DATE)
        AND status = 'completed'
      `);

      if (payroll && payroll.length > 0) {
        payrollMetrics.monthlyPayroll = parseFloat(payroll[0].total || 0);
        payrollMetrics.processed = parseInt(payroll[0].processed || 0);
      }
    } catch (e) { }

    return {
      hrMetrics: {
        totalEmployees: activeEmployees,
        activeEmployees,
        newHires: parseInt(newHires[0].count),
        pendingLeaves,
        attendance: {
          today: attendanceToday,
          rate: attendanceRate
        }
      },
      pmsMetrics,
      payrollMetrics
    };
  }
}
