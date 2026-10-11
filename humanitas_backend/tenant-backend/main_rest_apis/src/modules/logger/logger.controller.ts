import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { LoggerService } from './logger.service';

@ApiTags('Logs')
@ApiBearerAuth()
@Controller('logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('view_logs')
export class LoggerController {
  constructor(private readonly loggerService: LoggerService) { }

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

  @Get('recent')
  @ApiOperation({ summary: 'Get recent logs from all files' })
  async getRecentLogs(@Query('lines') lines?: string) {
    const files = this.loggerService.getLogFiles();
    const recentLogs: { file: string; logs: string[] }[] = [];

    // Get logs from the most recent file of each type
    const appFile = files.find((f) => f.name.startsWith('app-'));
    const errorFile = files.find((f) => f.name.startsWith('error-'));
    const schedulerFile = files.find((f) => f.name.startsWith('scheduler-'));

    const lineCount = lines ? parseInt(lines) : 100;

    if (appFile) {
      const result = this.loggerService.readLogFile(appFile.name, lineCount);
      recentLogs.push({ file: appFile.name, logs: result.content });
    }

    if (errorFile) {
      const result = this.loggerService.readLogFile(errorFile.name, lineCount);
      recentLogs.push({ file: errorFile.name, logs: result.content });
    }

    if (schedulerFile) {
      const result = this.loggerService.readLogFile(
        schedulerFile.name,
        lineCount,
      );
      recentLogs.push({ file: schedulerFile.name, logs: result.content });
    }

    return recentLogs;
  }
}
