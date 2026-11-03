import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ActingAssignmentsService {
    constructor(private readonly databaseService: DatabaseService) { }

    async create(tenantId: string, data: any) {
        const connection =
            await this.databaseService.getTenantConnectionById(tenantId);

        // Validate users exist
        const actor = await connection.query(`SELECT id FROM users WHERE id = $1`, [
            data.actor_user_id,
        ]);
        const target = await connection.query(
            `SELECT id FROM users WHERE id = $1`,
            [data.target_user_id],
        );

        if (!actor.length || !target.length) {
            throw new BadRequestException('Actor or Target user not found');
        }

        // Validate dates
        if (new Date(data.end_date) < new Date(data.start_date)) {
            throw new BadRequestException('End date must be after start date');
        }

        // Insert
        const result = await connection.query(
            `
      INSERT INTO acting_assignments (actor_user_id, target_user_id, start_date, end_date)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
            [data.actor_user_id, data.target_user_id, data.start_date, data.end_date],
        );

        return result[0];
    }

    async findAll(tenantId: string) {
        const connection =
            await this.databaseService.getTenantConnectionById(tenantId);
        return await connection.query(`
      SELECT aa.*, 
             u1.full_name as actor_name, 
             u2.full_name as target_name,
             u2.basic_salary as target_basic_salary,
             d.acting_position_title,
             d.acting_allowance_percentage,
             d.acting_allowance_amount,
             d.acting_allowance_type
      FROM acting_assignments aa
      JOIN users u1 ON aa.actor_user_id = u1.id
      JOIN users u2 ON aa.target_user_id = u2.id
      LEFT JOIN user_delegations d ON d.delegatee_id = aa.actor_user_id 
        AND d.delegator_id = aa.target_user_id 
        AND d.is_acting_assignment = true
        AND d.status = 'active'
      ORDER BY aa.created_at DESC
    `);
    }

    async remove(tenantId: string, id: string) {
        const connection =
            await this.databaseService.getTenantConnectionById(tenantId);
        await connection.query(`DELETE FROM acting_assignments WHERE id = $1`, [
            id,
        ]);
        return { message: 'Assignment deleted' };
    }
}
