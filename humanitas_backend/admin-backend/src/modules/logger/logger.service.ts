import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class LoggerService {
  // Point to tenant-backend logs directory
  private logsDir: string;

  constructor() {
    // Logs are stored in tenant-backend - use absolute path
    // Try multiple possible paths
    const possiblePaths = [
      path.join(process.cwd(), '..', 'tenant-backend', 'main_rest_apis', 'logs'),
      path.join(__dirname, '..', '..', '..', '..', '..', 'tenant-backend', 'main_rest_apis', 'logs'),
      'C:\\Users\\Math\\Downloads\\humanitas_backend\\tenant-backend\\main_rest_apis\\logs',
    ];
    
    this.logsDir = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    console.log('Logs directory:', this.logsDir, 'Exists:', fs.existsSync(this.logsDir));
  }

  getLogFiles(): { name: string; size: number; modified: Date }[] {
    try {
      if (!fs.existsSync(this.logsDir)) {
        return [];
      }
      const files = fs.readdirSync(this.logsDir);
      return files
        .filter(f => f.endsWith('.log'))
        .map(f => {
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

  readLogFile(filename: string, lines: number = 500, offset: number = 0): { 
    content: string[]; 
    totalLines: number;
    hasMore: boolean;
  } {
    try {
      const filePath = path.join(this.logsDir, filename);
      
      // Security check
      if (!filePath.startsWith(this.logsDir) || !filename.endsWith('.log')) {
        return { content: [], totalLines: 0, hasMore: false };
      }

      if (!fs.existsSync(filePath)) {
        return { content: [], totalLines: 0, hasMore: false };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const allLines = content.split('\n').filter(line => line.trim());
      const totalLines = allLines.length;
      
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
      const lines = content.split('\n').filter(line => line.trim());
      const lowerQuery = query.toLowerCase();
      
      return lines
        .filter(line => line.toLowerCase().includes(lowerQuery))
        .slice(-limit)
        .reverse();
    } catch {
      return [];
    }
  }
}
