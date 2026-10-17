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
        let dbUrl = configService.get<string>('DATABASE_URL');
        const sslEnabled = configService.get<string>('DATABASE_SSL') === 'true';

        // Auto-heal: in Docker containers, localhost refers to the container itself.
        // Map localhost/127.0.0.1 to host.docker.internal so it connects to VPS host PostgreSQL.
        if (dbUrl && (dbUrl.includes('@localhost:') || dbUrl.includes('@127.0.0.1:'))) {
          dbUrl = dbUrl.replace('@localhost:', '@host.docker.internal:').replace('@127.0.0.1:', '@host.docker.internal:');
        }

        const baseConfig = {
          type: 'postgres' as const,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get<string>('NODE_ENV') !== 'production', // Disable in production
          logging: configService.get<string>('NODE_ENV') === 'development',
        };

        const sslConfig = buildAdminSslConfig({
          dbUrl,
          sslEnabled,
          ca: configService.get<string>('DATABASE_SSL_CA'),
          explicitReject: configService.get<string>('DATABASE_SSL_REJECT_UNAUTHORIZED'),
        });

        if (dbUrl) {
          return {
            ...baseConfig,
            url: dbUrl,
            ssl: sslConfig,
          };
        }

        let dbHost = configService.get<string>('DATABASE_HOST');
        if (!dbHost || dbHost === 'localhost' || dbHost === '127.0.0.1') {
          dbHost = 'host.docker.internal';
        }

        return {
          ...baseConfig,
          host: dbHost,
          port: configService.get<number>('DATABASE_PORT', 5432),
          username: configService.get<string>('DATABASE_USERNAME'),
          password: configService.get<string>('DATABASE_PASSWORD'),
          database: configService.get<string>('DATABASE_NAME'),
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
  ],
})
export class AppModule { }
