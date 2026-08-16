import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { LoggerController } from './logger.controller';

@Global()
@Module({
  providers: [LoggerService],
  controllers: [LoggerController],
  exports: [LoggerService],
})
export class LoggerModule {}
