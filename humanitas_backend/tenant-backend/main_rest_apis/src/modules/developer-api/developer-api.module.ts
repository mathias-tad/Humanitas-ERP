import { Module } from '@nestjs/common';
import { DeveloperApiService } from './developer-api.service';
import { DeveloperApiController } from './developer-api.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DeveloperApiController],
  providers: [DeveloperApiService],
  exports: [DeveloperApiService],
})
export class DeveloperApiModule {}
