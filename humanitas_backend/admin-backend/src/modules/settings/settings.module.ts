import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PlatformSettings } from './entities/settings.entity';
import { AiSettings } from './entities/ai-settings.entity';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';
@Module({
  imports: [TypeOrmModule.forFeature([PlatformSettings, AiSettings])],
  controllers: [SettingsController, AiSettingsController],
  providers: [SettingsService, AiSettingsService],
  exports: [SettingsService, AiSettingsService],
})
export class SettingsModule {}
