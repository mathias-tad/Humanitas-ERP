import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;
  private logsDir: string;

  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');

    // Ensure logs directory exists
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, context, stack }) => {
        const ctx = context ? `[${context}]` : '';
        const stackTrace = stack ? `\n${stack}` : '';
        return `${timestamp} ${level.toUpperCase()} ${ctx} ${message}${stackTrace}`;
      }),
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, context }) => {
        const ctx = context ? `[${context}]` : '';
        return `${timestamp} ${level} ${ctx} ${message}`;
      }),
    );

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      transports: [
        // Console output
        new winston.transports.Console({
          format: consoleFormat,
        }),
        // All logs file (rotated daily)
        new winston.transports.DailyRotateFile({
          filename: path.join(this.logsDir, 'app-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: logFormat,
        }),
        // Error logs file (rotated daily)
        new winston.transports.DailyRotateFile({
          filename: path.join(this.logsDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error',
          format: logFormat,
        }),
        // Scheduler logs file
        new winston.transports.DailyRotateFile({
          filename: path.join(this.logsDir, 'scheduler-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          format: logFormat,
        }),
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { context, stack: trace });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }

  // Scheduler-specific logging
  scheduler(message: string, context?: string) {
    this.logger.info(message, { context: context || 'Scheduler' });
  }

  // Get available log files
  getLogFiles(): { name: string; size: number; modified: Date }[] {
    try {
      const files = fs.readdirSync(this.logsDir);
      return files
        .filter((f) => f.endsWith('.log'))
        .map((f) => {
          const stats = fs.statSync(path.join(this.logsDir, f));
          return {
            name: f,
            size: stats.size,
            modified: stats.mtime,
          };
        })
        .sort((a, b) => b.modified.getTime() - a.modified.getTime());
    } catch {
      return [];
    }
  }

  // Read log file content
  readLogFile(
    filename: string,
    lines: number = 500,
    offset: number = 0,
  ): {
    content: string[];
    totalLines: number;
    hasMore: boolean;
  } {
    try {
      const filePath = path.join(this.logsDir, filename);

      // Security check - prevent directory traversal
      if (!filePath.startsWith(this.logsDir) || !filename.endsWith('.log')) {
        return { content: [], totalLines: 0, hasMore: false };
      }

      if (!fs.existsSync(filePath)) {
        return { content: [], totalLines: 0, hasMore: false };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const allLines = content.split('\n').filter((line) => line.trim());
      const totalLines = allLines.length;

      // Get lines from the end (most recent first)
      const start = Math.max(0, totalLines - offset - lines);
      const end = totalLines - offset;
      const selectedLines = allLines.slice(start, end).reverse();

      return {
        content: selectedLines,
        totalLines,
        hasMore: start > 0,
      };
    } catch {
      return { content: [], totalLines: 0, hasMore: false };
    }
  }

  // Search logs
  searchLogs(filename: string, query: string, limit: number = 100): string[] {
    try {
      const filePath = path.join(this.logsDir, filename);

      if (!filePath.startsWith(this.logsDir) || !filename.endsWith('.log')) {
        return [];
      }

      if (!fs.existsSync(filePath)) {
        return [];
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      const lowerQuery = query.toLowerCase();

      return lines
        .filter((line) => line.toLowerCase().includes(lowerQuery))
        .slice(-limit)
        .reverse();
    } catch {
      return [];
    }
  }

  // Get logs directory path
  getLogsDir(): string {
    return this.logsDir;
  }
}
