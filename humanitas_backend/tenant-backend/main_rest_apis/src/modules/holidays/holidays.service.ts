import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/holiday.dto';

@Injectable()
export class HolidaysService {
    constructor(private readonly databaseService: DatabaseService) { }

    async ensureHolidaysTable(connection: any) {
        // Create table if it doesn't exist
        await connection.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        date DATE NOT NULL,
        description TEXT,
        is_recurring BOOLEAN DEFAULT TRUE,
        type VARCHAR DEFAULT 'public',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

        // Check for missing 'type' column (migration for existing tables)
        const hasTypeColumn = await connection.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'holidays' AND column_name = 'type'
        `);

        if (hasTypeColumn.length === 0) {
            await connection.query(`ALTER TABLE holidays ADD COLUMN type VARCHAR DEFAULT 'public'`);
        }
    }

    async seedDefaultHolidays(connection: any) {
        await this.ensureHolidaysTable(connection);

        // Check if any holidays exist
        const existing = await connection.query(`SELECT COUNT(*) as count FROM holidays`);
        if (parseInt(existing[0].count) > 0) {
            return; // Already populated
        }

        const currentYear = new Date().getFullYear();
        const ethiopianHolidays = [
            { name: 'Ethiopian Christmas (Genna)', date: `${currentYear}-01-07` },
            { name: 'Timkat (Epiphany)', date: `${currentYear}-01-19` },
            { name: 'Adwa Victory Day', date: `${currentYear}-03-02` },
            { name: 'International Labour Day', date: `${currentYear}-05-01` },
            { name: 'Patriots\' Victory Day', date: `${currentYear}-05-05` },
            { name: 'Downfall of the Derg', date: `${currentYear}-05-28` },
            { name: 'Enkutatash (New Year)', date: `${currentYear}-09-11` },
            { name: 'Meskel', date: `${currentYear}-09-27` },
        ];

        for (const h of ethiopianHolidays) {
            await connection.query(
                `INSERT INTO holidays (name, date, description, is_recurring, type) VALUES ($1, $2, $3, $4, $5)`,
                [h.name, h.date, 'Public Holiday', true, 'public']
            );
        }
        console.log(`Seeded ${ethiopianHolidays.length} Ethiopian holidays.`);
    }

    async findAll(tenantId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        await this.ensureHolidaysTable(connection);
        // Format date as YYYY-MM-DD string to avoid timezone issues on frontend
        return connection.query(`
            SELECT id, name, TO_CHAR(date, 'YYYY-MM-DD') as date, description, is_recurring, type, created_at, updated_at 
            FROM holidays 
            ORDER BY date ASC
        `);
    }

    async create(tenantId: string, dto: CreateHolidayDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        await this.ensureHolidaysTable(connection);

        const result = await connection.query(
            `INSERT INTO holidays (name, date, description, is_recurring, type) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [dto.name, dto.date, dto.description, dto.is_recurring ?? true, dto.type ?? 'public']
        );
        return result[0];
    }

    async update(tenantId: string, id: string, dto: UpdateHolidayDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        await this.ensureHolidaysTable(connection);

        // Dynamic update query builder
        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (dto.name) { fields.push(`name = $${paramIndex++}`); values.push(dto.name); }
        if (dto.date) { fields.push(`date = $${paramIndex++}`); values.push(dto.date); }
        if (dto.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(dto.description); }
        if (dto.is_recurring !== undefined) { fields.push(`is_recurring = $${paramIndex++}`); values.push(dto.is_recurring); }
        if (dto.type) { fields.push(`type = $${paramIndex++}`); values.push(dto.type); }

        if (fields.length === 0) return this.findOne(tenantId, id);

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const result = await connection.query(
            `UPDATE holidays SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.length === 0) throw new NotFoundException(`Holiday not found`);
        return result[0];
    }

    async delete(tenantId: string, id: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        await this.ensureHolidaysTable(connection);
        await connection.query(`DELETE FROM holidays WHERE id = $1`, [id]);
        return { success: true };
    }

    async findOne(tenantId: string, id: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const result = await connection.query(`SELECT * FROM holidays WHERE id = $1`, [id]);
        if (result.length === 0) throw new NotFoundException(`Holiday not found`);
        return result[0];
    }
}
