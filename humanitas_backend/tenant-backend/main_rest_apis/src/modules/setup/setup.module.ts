import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../auth/entities/tenant.entity';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), DatabaseModule],
  controllers: [SetupController],
  providers: [SetupService],
  exports: [SetupService],
})
export class SetupModule { }
