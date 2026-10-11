import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemLogsService } from './system-logs.service';
import { SystemLogsController } from './system-logs.controller';
import { CalculationLog } from './entities/calculation-log.entity';
import { Tenant } from '../auth/entities/tenant.entity';
import { DatabaseModule } from '../database/database.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([CalculationLog, Tenant]),
        DatabaseModule,
    ],
    controllers: [SystemLogsController],
    providers: [SystemLogsService],
    exports: [SystemLogsService]
})
export class SystemLogsModule { }

