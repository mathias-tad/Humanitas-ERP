import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { MessagingGateway } from './messaging.gateway';
import { MessageEncryptionService } from './encryption/message-encryption.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        UsersModule,
        ConfigModule,
        JwtModule.register({}), // We need JwtService for Gateway
    ],
    controllers: [MessagingController],
    providers: [MessagingService, MessagingGateway, MessageEncryptionService],
    exports: [MessagingService],
})
export class MessagingModule { }
