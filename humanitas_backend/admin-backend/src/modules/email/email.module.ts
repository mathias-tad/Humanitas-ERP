import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { PlatformSettings } from '../settings/entities/settings.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PlatformSettings])],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
