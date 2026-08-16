import {
  Controller,
  Get,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoggerService } from './logger.service';

@ApiTags('Logs')
@ApiBearerAuth()
@Controller('logs')
@UseGuards(JwtAuthGuard)
export class LoggerController {
  constructor(private readonly loggerService: LoggerService) {}

  @Get('files')
  @ApiOperation({ summary: 'Get list of log files' })
  async getLogFiles() {
    return this.loggerService.getLogFiles();
  }

  @Get('read/:filename')
  @ApiOperation({ summary: 'Read log file content' })
  async readLogFile(
    @Param('filename') filename: string,
    @Query('lines') lines?: string,
    @Query('offset') offset?: string,
  ) {
    return this.loggerService.readLogFile(
      filename,
      lines ? parseInt(lines) : 500,
      offset ? parseInt(offset) : 0,
    );
  }

  @Get('search/:filename')
  @ApiOperation({ summary: 'Search in log file' })
  async searchLogs(
    @Param('filename') filename: string,
    @Query('query') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.loggerService.searchLogs(
      filename,
      query,
      limit ? parseInt(limit) : 100,
    );
  }
}
