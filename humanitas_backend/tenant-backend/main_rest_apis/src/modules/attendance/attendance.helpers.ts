import type { DataSource } from 'typeorm';
import { DatabaseService } from '../database/database.service';

/** Shared helpers used by the attendance services (moved verbatim from AttendanceService). */

// Get company timezone from general settings
export async function getCompanyTimezone(connection: DataSource): Promise<string> {
  try {
    const result = await connection.query(
      `SELECT data FROM settings WHERE category = 'general'`,
    );
    if (result && result.length > 0 && result[0].data) {
      const settings =
        typeof result[0].data === 'string'
          ? JSON.parse(result[0].data)
          : result[0].data;
      return settings.timezone || 'UTC';
    }
  } catch (e) {
    console.log(
      '[Attendance] Could not get timezone from settings, using UTC',
    );
  }
  return 'UTC';
}


// Get HR settings
export async function getHRSettings(connection: DataSource): Promise<any> {
  try {
    const result = await connection.query(
      `SELECT data FROM settings WHERE category = 'hr'`,
    );
    if (result && result.length > 0 && result[0].data) {
      return typeof result[0].data === 'string'
        ? JSON.parse(result[0].data)
        : result[0].data;
    }
  } catch (e) {
    console.log('[Attendance] Could not get HR settings');
  }
  return {};
}


// Get current date/time in company timezone
export function getCurrentTimeInTimezone(timezone: string): {
  now: Date;
  today: string;
  currentMinutes: number;
} {
  const now = new Date();

  // Get time components in the specified timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat('en-CA', options);
  const parts = formatter.formatToParts(now);

  const dateParts: Record<string, string> = {};
  for (const part of parts) {
    dateParts[part.type] = part.value;
  }

  const year = dateParts.year;
  const month = dateParts.month;
  const day = dateParts.day;
  const hour = parseInt(dateParts.hour, 10);
  const minute = parseInt(dateParts.minute, 10);

  const today = `${year}-${month}-${day}`;
  const currentMinutes = hour * 60 + minute;

  // Create a date object representing the local time in the timezone
  const localNow = new Date(
    `${today}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}`,
  );

  return { now: localNow, today, currentMinutes };
}


// Audit Log Helper
export async function logToTenantAudit(
  databaseService: DatabaseService,
  tenantId: string,
  userId: string,
  action: string,
  targetId: string,
  details: any,
) {
  try {
    console.error(`[Audit] Logging action: ${action} by user: ${userId}`);
    const connection = await databaseService.getTenantConnectionById(tenantId);
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, target_id, details) VALUES ($1, $2, $3, $4)`,
      [userId, action, targetId, details],
    );
    console.error(`[Audit] Successfully logged action: ${action}`);
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}
