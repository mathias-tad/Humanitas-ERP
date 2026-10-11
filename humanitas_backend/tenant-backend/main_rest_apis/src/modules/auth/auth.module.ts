import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Tenant } from './entities/tenant.entity';
import { DatabaseModule } from '../database/database.module';
import { PermissionsGuard } from './guards/permissions.guard';
import { ModuleSubscriptionGuard } from './guards/module-subscription.guard';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '6h') as any,
        },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PermissionsGuard, ModuleSubscriptionGuard],
  exports: [AuthService, PermissionsGuard, ModuleSubscriptionGuard, TypeOrmModule],
})
export class AuthModule {}
