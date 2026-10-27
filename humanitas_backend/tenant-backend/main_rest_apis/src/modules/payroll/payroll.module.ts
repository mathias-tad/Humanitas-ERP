import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollScheduler } from './payroll.scheduler';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { ActingAssignmentsController } from './acting/acting-assignments.controller';
import { ActingAssignmentsService } from './acting/acting-assignments.service';
import { PerDiemController } from './per-diem.controller';
import { PerDiemService } from './per-diem.service';
import { UserPenaltyController } from './user-penalty.controller';
import { UserPenaltyService } from './user-penalty.service';
import { UserPenalty } from './entities/user-penalty.entity';
import { TaxRule } from './entities/tax-rule.entity';

import { LoanController } from './loan.controller';
import { LoanService } from './loan.service';
import { AbsencePenaltyController } from './absence-penalty.controller';
import { SettingsModule } from '../settings/settings.module';
import { AbsencePenaltyService } from './absence-penalty.service';
import { LateMinuteService } from './late-minute.service';
import { BankTransferExportService } from './bank-transfer-export.service';

@Module({
  imports: [DatabaseModule, NotificationsModule, TypeOrmModule.forFeature([Tenant, UserPenalty]), SettingsModule],
  controllers: [PayrollController, ActingAssignmentsController, PerDiemController, UserPenaltyController, LoanController, AbsencePenaltyController],
  providers: [PayrollService, PayrollScheduler, ActingAssignmentsService, PerDiemService, UserPenaltyService, LoanService, AbsencePenaltyService, LateMinuteService, BankTransferExportService],
  exports: [PayrollService, PayrollScheduler, PerDiemService, UserPenaltyService, LoanService, AbsencePenaltyService, LateMinuteService, BankTransferExportService],
})
export class PayrollModule { }
