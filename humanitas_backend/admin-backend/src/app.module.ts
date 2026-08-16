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
        const dbUrl = configService.get<string>('DATABASE_URL');
        const sslEnabled = configService.get<string>('DATABASE_SSL') === 'true';

        const baseConfig = {
          type: 'postgres' as const,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get<string>('NODE_ENV') !== 'production', // Disable in production
          logging: configService.get<string>('NODE_ENV') === 'development',
        };

        if (dbUrl) {
          return {
            ...baseConfig,
            url: dbUrl,
            ssl: (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) ? false : (sslEnabled ? { rejectUnauthorized: false } : false),
          };
        }

        return {
          ...baseConfig,
          host: configService.get<string>('DATABASE_HOST'),
          port: configService.get<number>('DATABASE_PORT', 5432),
          username: configService.get<string>('DATABASE_USERNAME'),
          password: configService.get<string>('DATABASE_PASSWORD'),
          database: configService.get<string>('DATABASE_NAME'),
          ssl: sslEnabled ? { rejectUnauthorized: false } : false,
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
