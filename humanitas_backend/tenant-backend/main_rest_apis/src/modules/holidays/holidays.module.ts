import { Module } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { HolidaysController } from './holidays.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [HolidaysController],
    providers: [HolidaysService],
    exports: [HolidaysService],
})
export class HolidaysModule { }
