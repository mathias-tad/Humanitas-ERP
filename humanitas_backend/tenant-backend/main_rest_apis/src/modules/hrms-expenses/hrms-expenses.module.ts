import { Module } from '@nestjs/common';
import { HrmsExpensesController } from './hrms-expenses.controller';
import { HrmsExpensesService } from './hrms-expenses.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [HrmsExpensesController],
  providers: [HrmsExpensesService],
  exports: [HrmsExpensesService],
})
export class HrmsExpensesModule {}
