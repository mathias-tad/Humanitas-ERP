import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm'; // Import DataSource
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UserModule } from './modules/user/user.module';
import { AdminModule } from './modules/admin/admin.module';
import { SettingsModule } from './modules/settings/settings.module';
import { EmailModule } from './modules/email/email.module';
import { HealthModule } from './modules/health/health.module';
import { LoggerModule } from './modules/logger/logger.module';
import { BillingModule } from './modules/billing/billing.module';
import { PlatformKnowledgeModule } from './modules/platform-knowledge/platform-knowledge.module';
import { SupportTicketsModule } from './modules/support-tickets/support-tickets.module';
import * as dns from 'dns';

import { buildAdminSslConfig } from './database/ssl-config.helper';

// Force IPv4 for DNS resolution (fixes Supabase IPv6 issues)
dns.setDefaultResultOrder('ipv4first');

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database (Master)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const rawDbUrl = configService.get<string>('DATABASE_URL');
        const sslEnabled = configService.get<string>('DATABASE_SSL') === 'true';

        let dbHost = configService.get<string>('DATABASE_HOST', 'host.docker.internal');
        let dbPort = Number(configService.get<string | number>('DATABASE_PORT', 5432));
        let dbUser = configService.get<string>('DATABASE_USERNAME', 'postgres');
        let dbPassword = configService.get<string>('DATABASE_PASSWORD', '');
        let dbName = configService.get<string>('DATABASE_NAME', 'tenant');

        if (rawDbUrl) {
          try {
            // URL or connection string parser
            const cleanUrl = rawDbUrl.startsWith('postgresql://') || rawDbUrl.startsWith('postgres://')
              ? rawDbUrl
              : `postgresql://${rawDbUrl}`;
            const parsed = new URL(cleanUrl);
            if (parsed.hostname) dbHost = parsed.hostname;
            if (parsed.port) dbPort = parseInt(parsed.port, 10);
            if (parsed.username) dbUser = decodeURIComponent(parsed.username);
            if (parsed.password) dbPassword = decodeURIComponent(parsed.password);
            if (parsed.pathname && parsed.pathname.length > 1) {
              dbName = parsed.pathname.slice(1).split('?')[0];
            }
          } catch {
            // Fallback for non-standard formats
            try {
              const parsePg = require('pg-connection-string').parse;
              const parsed = parsePg(rawDbUrl);
              if (parsed.host) dbHost = parsed.host;
              if (parsed.port) dbPort = parseInt(parsed.port, 10);
              if (parsed.user) dbUser = parsed.user;
              if (parsed.password) dbPassword = parsed.password;
              if (parsed.database) dbName = parsed.database;
            } catch {
              // keep defaults
            }
          }
        }

        // Auto-heal: map localhost/127.0.0.1 to host.docker.internal in Docker
        if (dbHost === 'localhost' || dbHost === '127.0.0.1') {
          dbHost = 'host.docker.internal';
        }
        // Guarantee username is never empty (prevents: "no PostgreSQL user name specified in startup packet")
        if (!dbUser) {
          dbUser = 'postgres';
        }

        const baseConfig = {
          type: 'postgres' as const,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get<string>('NODE_ENV') !== 'production', // Disable in production
          logging: configService.get<string>('NODE_ENV') === 'development',
        };

        const sslConfig = buildAdminSslConfig({
          dbUrl: rawDbUrl,
          sslEnabled,
          ca: configService.get<string>('DATABASE_SSL_CA'),
          explicitReject: configService.get<string>('DATABASE_SSL_REJECT_UNAUTHORIZED'),
        });

        return {
          ...baseConfig,
          host: dbHost,
          port: dbPort,
          username: dbUser,
          password: dbPassword,
          database: dbName,
          ssl: sslConfig,
        };
      },
      inject: [ConfigService],
    }),

    // Core modules
    HealthModule,
    EmailModule,
    AuthModule,
    TenantModule,
    UserModule,
    AdminModule,
    SettingsModule,
    LoggerModule,
    BillingModule,
    PlatformKnowledgeModule,
    SupportTicketsModule,
  ],
})
export class AppModule { }
