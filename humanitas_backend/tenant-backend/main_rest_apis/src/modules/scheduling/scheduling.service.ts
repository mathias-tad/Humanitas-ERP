import { CreateShiftDto, UpdateShiftDto } from './dto/create-shift.dto';
import { CreateShiftPatternDto, UpdateShiftPatternDto } from './dto/create-pattern.dto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';

import { AssignScheduleDto } from './dto/assign-schedule.dto';
import { AssignPatternDto } from './dto/assign-pattern.dto';

import { SettingsService } from '../settings/settings.service';
import { HolidaysService } from '../holidays/holidays.service';

@Injectable()
export class SchedulingService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly settingsService: SettingsService,
    private readonly holidaysService: HolidaysService,
  ) { }

  private async ensureSchedulingTables(connection: any) {
    // Run migration check before creating schema to ensure clean state or after?
    // Better after creating new tables so we can insert into them.

    await connection.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        color VARCHAR(20) DEFAULT '#3B82F6',
        is_overnight BOOLEAN DEFAULT false,
        description TEXT,
        grace_minutes INTEGER DEFAULT 15,
        wait_for_absent_minutes INTEGER DEFAULT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        shift_id UUID REFERENCES shifts(id),
        date DATE NOT NULL,
        is_day_off BOOLEAN DEFAULT false,
        is_override BOOLEAN DEFAULT false,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      );

      CREATE TABLE IF NOT EXISTS shift_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        cycle_length_days INTEGER NOT NULL,
        shifts JSONB NOT NULL,
        enable_dayoff_rotation BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_shift_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        pattern_id UUID REFERENCES shift_patterns(id),
        start_date DATE NOT NULL,
        end_date DATE,
        day_off_days JSONB DEFAULT '[]',
        auto_rotate_dayoff BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );

      CREATE TABLE IF NOT EXISTS attendance_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        date DATE NOT NULL,
        shift_id UUID REFERENCES shifts(id),
        scheduled_in TIME,
        scheduled_out TIME,
        actual_in TIMESTAMP,
        actual_out TIMESTAMP,
        status VARCHAR(20) DEFAULT 'Pending',
        work_hours INTERVAL,
        remarks TEXT,
        is_corrected BOOLEAN DEFAULT false,
        corrected_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      );
    `);

    // Migration for existing tenants
    try {
      await connection.query(`
        ALTER TABLE shift_patterns ADD COLUMN IF NOT EXISTS enable_dayoff_rotation BOOLEAN DEFAULT false;
        ALTER TABLE user_shift_patterns ADD COLUMN IF NOT EXISTS day_off_days JSONB DEFAULT '[]';
        ALTER TABLE user_shift_patterns ADD COLUMN IF NOT EXISTS auto_rotate_dayoff BOOLEAN DEFAULT true;
        ALTER TABLE schedules ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS grace_minutes INTEGER DEFAULT 15;
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS wait_for_absent_minutes INTEGER DEFAULT NULL;
      `);
    } catch (e) {
      console.log('[Scheduling] Migration columns might already exist');
    }

    // Trigger Migration
    await this.migrateLegacyData(connection);
  }

  // ============ MIGRATION LOGIC ============
  private async migrateLegacyData(connection: any) {
    try {
      // 1. Check if legacy tables exist
      const legacyTablesExist = await connection.query(`
        SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_name = 'schedule_patterns'
        ) as exists
      `);

      if (!legacyTablesExist[0]?.exists) return;

      // 2. Check if new tables are empty (to avoid double migration)
      const newPatternsCount = await connection.query(`SELECT COUNT(*) as count FROM shift_patterns`);
      if (parseInt(newPatternsCount[0].count) > 0) return; // Already migrated or active

      console.log('[Scheduling] 🔄 Detected legacy data. Starting migration...');

      // 3. Migrate Patterns
      // Fetch legacy patterns with their weeks
      const legacyPatterns = await connection.query(`SELECT * FROM schedule_patterns WHERE is_active = true`);

      for (const oldPat of legacyPatterns) {
        // Fetch rotation weeks for this pattern
        const weeks = await connection.query(`
          SELECT * FROM rotation_weeks WHERE pattern_id = $1 ORDER BY week_number
        `, [oldPat.id]);

        // Convert to new format: Array of objects { day_number, shift_id, is_day_off }
        const shifts: any[] = [];
        let cycleLength = 0;

        if (weeks.length > 0) {
          // Assume weekly rotation (7 days per week)
          cycleLength = weeks.length * 7;

          for (const week of weeks) {
            const weekOffset = (week.week_number - 1) * 7;
            const daysOff = week.days_off || ['Sat', 'Sun'];
            const dayMap: { [key: string]: number } = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7 }; // 1-based ISO

            // For each day in the week
            for (let d = 1; d <= 7; d++) {
              const dayStr = Object.keys(dayMap).find(key => dayMap[key] === d) || 'Unknown';
              const isOff = daysOff.includes(dayStr);

              shifts.push({
                day_number: weekOffset + d,
                shift_id: isOff ? null : week.shift_id, // If off, no shift; else access shift_id
                is_day_off: isOff
              });
            }
          }
        } else {
          // Default fixed pattern if no weeks (unlikely but safe)
          cycleLength = 7;
        }

        // Insert into new table
        // Map legacy ID to new ID if we want to preserve history? 
        // Or just let it generate new ID. 
        // If we generate new ID, we must update assignments.
        // Let's use name to map or just carry over IDs if they were UUIDs? 
        // Postgres gen_random_uuid() generates them. 
        // We can force insert the ID if we want, but let's just create new ones and map them in memory for assignments.

        const newPatternResult = await connection.query(`
          INSERT INTO shift_patterns (name, description, cycle_length_days, shifts, enable_dayoff_rotation, is_active)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [
          oldPat.name,
          `Migrated from ${oldPat.rotation_type}`,
          cycleLength,
          JSON.stringify(shifts),
          false, // legacy didn't have this auto-logic in same way
          oldPat.is_active
        ]);

        const newPatternId = newPatternResult[0].id;
        oldPat.new_id = newPatternId; // Store for assignment migration
      }

      // 4. Migrate Assignments
      const legacyAssignments = await connection.query(`SELECT * FROM shift_assignments`);

      for (const assign of legacyAssignments) {
        // Find corresponding new pattern ID
        const matchingPattern = legacyPatterns.find((p: any) => p.id === assign.pattern_id);
        const newId = matchingPattern ? matchingPattern.new_id : null;

        if (newId) {
          await connection.query(`
              INSERT INTO user_shift_patterns (user_id, pattern_id, start_date, auto_rotate_dayoff)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (user_id) DO NOTHING
            `, [
            assign.user_id,
            newId,
            assign.effective_date,
            false // standard legacy behavior
          ]);
        }
      }

      console.log('[Scheduling] ✅ Migration completed successfully.');

    } catch (e) {
      console.error('[Scheduling] ❌ Migration failed:', e);
    }
  }

  // ============ SHIFTS ============
  async createShift(tenantId: string, dto: CreateShiftDto, userId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);
    const result = await connection.query(
      `
      INSERT INTO shifts (name, start_time, end_time, color, is_overnight, description, grace_minutes, wait_for_absent_minutes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [
        dto.name,
        dto.start_time,
        dto.end_time,
        dto.color,
        dto.is_overnight || false,
        dto.description,
        dto.grace_minutes || 15,
        dto.wait_for_absent_minutes || null,
      ],
    );

    const shift = result[0];
    await this.logToTenantAudit(
      tenantId,
      userId,
      'CREATE_SHIFT',
      shift.id,
      dto,
    );
    return shift;
  }

  async getShifts(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);
    return await connection.query(`SELECT * FROM shifts WHERE is_active = true ORDER BY name`);
  }

  async updateShift(tenantId: string, shiftId: string, dto: UpdateShiftDto, userId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);

    const result = await connection.query(
      `
      UPDATE shifts SET 
        name = COALESCE($1, name),
        start_time = COALESCE($2, start_time),
        end_time = COALESCE($3, end_time),
        color = COALESCE($4, color),
        is_overnight = COALESCE($5, is_overnight),
        description = COALESCE($6, description),
        grace_minutes = COALESCE($7, grace_minutes),
        wait_for_absent_minutes = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `,
      [
        dto.name,
        dto.start_time,
        dto.end_time,
        dto.color,
        dto.is_overnight,
        dto.description,
        dto.grace_minutes,
        dto.wait_for_absent_minutes,
        shiftId,
      ],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Shift not found');
    }

    await this.logToTenantAudit(tenantId, userId, 'UPDATE_SHIFT', shiftId, dto);
    return result[0];
  }

  async deleteShift(tenantId: string, shiftId: string, userId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);

    // Soft delete
    await connection.query(
      `UPDATE shifts SET is_active = false WHERE id = $1`,
      [shiftId],
    );

    await this.logToTenantAudit(
      tenantId,
      userId,
      'DELETE_SHIFT',
      shiftId,
      { deleted_at: new Date() },
    );
    return { message: 'Shift deleted successfully' };
  }

  // ============ PATTERNS ============
  async createPattern(
    tenantId: string,
    dto: CreateShiftPatternDto,
    userId: string,
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);
    const result = await connection.query(
      `
      INSERT INTO shift_patterns (name, description, cycle_length_days, shifts, enable_dayoff_rotation)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
      [
        dto.name,
        dto.description,
        dto.cycle_length_days,
        JSON.stringify(dto.shifts),
        dto.enable_dayoff_rotation || false,
      ],
    );

    const pattern = result[0];
    await this.logToTenantAudit(
      tenantId,
      userId,
      'CREATE_PATTERN',
      pattern.id,
      dto,
    );
    return pattern;
  }

  async getPatterns(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);
    return await connection.query(
      `SELECT * FROM shift_patterns WHERE is_active = true ORDER BY name`,
    );
  }

  async getPatternById(tenantId: string, patternId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);
    const result = await connection.query(
      `SELECT * FROM shift_patterns WHERE id = $1 AND is_active = true`,
      [patternId],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Pattern with ID ${patternId} not found`);
    }

    return result[0];
  }

  async updatePattern(
    tenantId: string,
    patternId: string,
    dto: UpdateShiftPatternDto,
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);

    // Verify existence
    await this.getPatternById(tenantId, patternId);

    const result = await connection.query(
      `
      UPDATE shift_patterns
      SET name = $1, description = $2, cycle_length_days = $3, shifts = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `,
      [
        dto.name,
        dto.description,
        dto.cycle_length_days,
        JSON.stringify(dto.shifts),
        patternId,
      ],
    );

    return result[0];
  }

  async deletePattern(tenantId: string, patternId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);

    // Soft delete
    await connection.query(
      `UPDATE shift_patterns SET is_active = false WHERE id = $1`,
      [patternId],
    );

    return { message: 'Pattern deleted successfully' };
  }

  // ============ ASSIGNMENTS (ROSTER) ============

  // 1. Assign/Override specific day
  async assignSchedule(
    tenantId: string,
    dto: AssignScheduleDto,
    userId: string,
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);

    const result = await connection.query(
      `
      INSERT INTO schedules (user_id, shift_id, date, is_day_off, is_override, note)
      VALUES ($1, $2, $3, $4, true, $5)
      ON CONFLICT (user_id, date) DO UPDATE SET
        shift_id = $2,
        is_day_off = $4,
        is_override = true,
        note = $5,
        updated_at = NOW()
      RETURNING *
    `,
      [
        dto.user_id,
        dto.shift_id || null,
        dto.date,
        dto.is_day_off || false,
        dto.note,
      ],
    );

    const schedule = result[0];
    await this.logToTenantAudit(
      tenantId,
      userId,
      'ASSIGN_SCHEDULE',
      schedule.id,
      { ...dto, target_user: dto.user_id },
    );
    return schedule;
  }

  // 2. Assign Pattern (Auto-Rotation)
  async assignPattern(tenantId: string, dto: AssignPatternDto, userId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);

    const startDate = dto.start_date || new Date().toISOString().split('T')[0];

    const result = await connection.query(
      `
      INSERT INTO user_shift_patterns (user_id, pattern_id, start_date, end_date, day_off_days, auto_rotate_dayoff)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        pattern_id = $2,
        start_date = $3,
        end_date = $4,
        day_off_days = $5,
        auto_rotate_dayoff = $6,
        updated_at = NOW()
      RETURNING *
    `,
      [
        dto.user_id,
        dto.pattern_id || null,
        startDate,
        dto.end_date || null,
        JSON.stringify(dto.day_off_days || []), // Default to empty array if not provided
        dto.auto_rotate_dayoff ?? true // Default to true
      ],
    );

    const assignment = result[0];
    await this.logToTenantAudit(
      tenantId,
      userId,
      'ASSIGN_PATTERN',
      assignment.id,
      { ...dto, target_user: dto.user_id },
    );
    return assignment;
  }

  async getUserShiftPatterns(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);

    return await connection.query(`
      SELECT usp.*, 
             u.full_name, u.email, u.department, u.position, u.avatar_url,
             sp.name as pattern_name, sp.description as pattern_description
      FROM user_shift_patterns usp
      JOIN users u ON usp.user_id = u.id
      LEFT JOIN shift_patterns sp ON usp.pattern_id = sp.id
      WHERE u.is_active = true
      ORDER BY u.full_name
    `);
  }

  async getUnassignedUsers(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    return await connection.query(`
      SELECT u.id, u.full_name, u.email, u.department, u.position, u.avatar_url
      FROM users u
      LEFT JOIN user_shift_patterns usp ON u.id = usp.user_id
      WHERE u.is_active = true AND usp.id IS NULL
      ORDER BY u.full_name
    `);
  }

  async getUsersWithAssignments(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);

    return await connection.query(`
      SELECT u.id, u.full_name, u.email, u.department, u.position, u.avatar_url,
             usp.id as assignment_id, 
             usp.pattern_id,
             sp.name as pattern_name,
             CASE WHEN usp.id IS NOT NULL THEN 'Assigned' ELSE 'Unassigned' END as status
      FROM users u
      LEFT JOIN user_shift_patterns usp ON u.id = usp.user_id
      LEFT JOIN shift_patterns sp ON usp.pattern_id = sp.id
      WHERE u.is_active = true
      ORDER BY u.full_name
    `);
  }

  async removePatternAssignment(tenantId: string, userId: string, auditUserId?: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);

    await connection.query(`DELETE FROM user_shift_patterns WHERE user_id = $1`, [userId]);

    if (auditUserId) {
      await this.logToTenantAudit(tenantId, auditUserId, 'REMOVE_ASSIGNMENT', userId, { target_user: userId });
    }

    return { message: 'Assignment removed successfully' };
  }


  // ============ CALCULATION (THE CORE) ============
  async getUserSchedule(
    tenantId: string,
    userId: string,
    startDate: string,
    endDate: string,
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);

    const start = new Date(startDate);
    const end = new Date(endDate);
    console.log(`[getUserSchedule] Fetching for ${userId} from ${startDate} to ${endDate}`);

    // 1. Get Manual Overrides (Schedules) with modification metadata
    const schedules = await connection.query(
      `
    SELECT s.id, s.user_id, s.shift_id, TO_CHAR(s.date, 'YYYY-MM-DD') as date_str, s.is_day_off, s.is_override, s.note, 
           sh.name as shift_name, sh.start_time, sh.end_time, sh.color,
           s.updated_at, u.full_name as updated_by_name
    FROM schedules s
    LEFT JOIN shifts sh ON s.shift_id = sh.id
    LEFT JOIN users u ON s.updated_by = u.id
    WHERE s.user_id = $1 AND s.date BETWEEN $2 AND $3
  `,
      [userId, startDate, endDate],
    );

    // 2. Get User Pattern (with rotation settings) - Use LEFT JOIN to allow Standard Schedule (null pattern_id)
    const userPatternResult = await connection.query(
      `
    SELECT usp.id, usp.user_id, usp.pattern_id, TO_CHAR(usp.start_date, 'YYYY-MM-DD') as start_date_str, usp.end_date, 
           usp.day_off_days, usp.auto_rotate_dayoff,
           sp.cycle_length_days, sp.shifts as pattern_shifts
    FROM user_shift_patterns usp
    LEFT JOIN shift_patterns sp ON usp.pattern_id = sp.id
    WHERE usp.user_id = $1
  `,
      [userId],
    );
    const userPattern = userPatternResult[0];

    // 3. Get All Shifts (for pattern lookup / standard fallback)
    const allShifts = await connection.query(`SELECT * FROM shifts`);
    const shiftsMap = new Map<string, any>(
      allShifts.map((s: any) => [s.id, s]),
    );

    // Find a default shift for Standard Schedule (e.g., first active one)
    const defaultStandardShift = allShifts.find((s: any) => s.is_active) || null;

    // 4. Get Attendance Records
    const attendance = await connection.query(
      `SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, actual_in FROM attendance_records WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
      [userId, startDate, endDate],
    );

    // 5. Get HR Settings for Working Days (Standard Schedule)
    const hrSettings = await this.settingsService.getHRSettings(tenantId);
    const workingDays = hrSettings.work_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const stdStart = hrSettings.standard_start_time || '09:00';
    const stdEnd = hrSettings.standard_end_time || '17:00';

    // 6. Get Holidays
    const holidays = await this.holidaysService.findAll(tenantId);
    const holidayDateMap = new Set(holidays.map((h: any) => h.date)); // stored as YYYY-MM-DD

    const result: any[] = [];
    const current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];

      // Check for attendance info
      const attRecord = attendance.find((a: any) => a.date_str === dateStr);
      const hasAttendance = !!attRecord;

      // A. Check for Override
      const override = schedules.find((s: any) => s.date_str === dateStr);

      if (override) {
        result.push({
          date: dateStr,
          type: 'Manual',
          has_attendance: hasAttendance,
          ...override,
          shift: override.shift_id
            ? {
              id: override.shift_id,
              name: override.shift_name,
              start: override.start_time,
              end: override.end_time,
              color: override.color,
            }
            : null,
        });
      } else if (userPattern) {
        // B. Calculate Pattern
        let finalShift: any = null;
        let isDayOff = false;
        let type = 'Pattern';

        if (!userPattern.pattern_id) {
          // --- STANDARD SCHEDULE LOGIC ---
          // console.log(`[getUserSchedule] Using Standard Schedule for ${userId} on ${dateStr}`);
          type = 'Standard';
          const dayName = current.toLocaleDateString('en-US', { weekday: 'short' });
          const isWorkingDay = workingDays.some((wd: string) => wd.startsWith(dayName));
          const isHoliday = holidayDateMap.has(dateStr);

          if (isHoliday) {
            isDayOff = true;
            finalShift = null;
          } else if (isWorkingDay) {
            // Construct dynamic standard shift
            finalShift = {
              id: 'STANDARD',
              name: 'Standard',
              start_time: stdStart,
              end_time: stdEnd,
              color: '#3b82f6',
              is_active: true
            };
          } else {
            isDayOff = true;
          }

        } else if (userPattern.cycle_length_days && userPattern.pattern_shifts) {
          // --- CUSTOM PATTERN LOGIC ---
          const patternStart = new Date(userPattern.start_date_str);
          const diffTime = current.getTime() - patternStart.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays >= 0) {
            const cycleIndex = diffDays % userPattern.cycle_length_days;
            const dayInCycle = cycleIndex + 1;

            const patternDay = userPattern.pattern_shifts.find(
              (ps: any) => ps.day_number === dayInCycle,
            );

            if (patternDay) {
              isDayOff = patternDay.is_day_off;
              if (!isDayOff && patternDay.shift_id) {
                finalShift = shiftsMap.get(patternDay.shift_id);
              }
            }
          } else {
            // Before pattern start date
            type = 'PrePattern';
            isDayOff = true;
          }
        }

        // --- APPLY ASSIGNMENT-LEVEL DAY OFF ROTATION ---
        const assignmentDayOffs = userPattern.day_off_days || [];
        // Only apply if we have a start date valid for calculation
        if (assignmentDayOffs.length > 0 && userPattern.start_date_str) {
          const patternStart = new Date(userPattern.start_date_str);
          const diffTime = current.getTime() - patternStart.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays >= 0) {
            const weekNumber = Math.floor(diffDays / 7);
            const jsDayOfWeek = current.getDay(); // 0=Sun
            const currentDayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1; // 0=Mon

            let rotatedOffDays = assignmentDayOffs;
            if (userPattern.auto_rotate_dayoff) {
              rotatedOffDays = assignmentDayOffs.map((d: number) => (d + weekNumber) % 7);
            }

            if (rotatedOffDays.includes(currentDayOfWeek)) {
              isDayOff = true;
            }
          }
        }

        result.push({
          user_id: userId,
          date: dateStr,
          type: type,
          has_attendance: hasAttendance,
          is_day_off: isDayOff,
          shift_id: isDayOff ? null : (finalShift?.id || null),
          shift: finalShift ? {
            id: finalShift.id,
            name: finalShift.name,
            start: finalShift.start_time,
            end: finalShift.end_time,
            color: finalShift.color
          } : null
        });

      } else {
        // C. No Pattern Assigned
        result.push({
          user_id: userId,
          date: dateStr,
          type: 'Empty',
          has_attendance: hasAttendance,
          is_day_off: true
        });
      }

      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  // ============ AUDIT LOGS ============
  async getAuditLogs(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureSchedulingTables(connection);
    return await connection.query(`
            SELECT a.*, u.full_name as user_name, u.email as user_email 
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC 
            LIMIT 100
        `);
  }

  // Helper to log without AuditService dependency issues for Tenant DB
  private async logToTenantAudit(
    tenantId: string,
    userId: string,
    action: string,
    targetId: string,
    details: any,
  ) {
    try {
      const connection =
        await this.databaseService.getTenantConnectionById(tenantId);
      await connection.query(
        `
                INSERT INTO audit_logs (user_id, action, target_id, details)
                VALUES ($1, $2, $3, $4)
             `,
        [userId, action, targetId, JSON.stringify(details)],
      );
    } catch (e) {
      console.error('Failed to log audit:', e);
    }
  }
}
