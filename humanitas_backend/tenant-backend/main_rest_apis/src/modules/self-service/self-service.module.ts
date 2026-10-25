import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SelfServiceService } from './self-service.service';
import { SelfServiceController } from './self-service.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [SelfServiceController],
  providers: [SelfServiceService],
  exports: [SelfServiceService],
})
export class SelfServiceModule {}
