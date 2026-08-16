import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
    constructor(
        @InjectRepository(AuditLog)
        private auditRepository: Repository<AuditLog>,
    ) { }

    async logAction(
        userId: string,
        action: string,
        targetId: string,
        details?: any,
    ) {
        const log = this.auditRepository.create({
            user_id: userId,
            action,
            target_id: targetId,
            details,
        });
        return this.auditRepository.save(log);
    }

    async getLogs(limit: number = 100) {
        return this.auditRepository.find({
            order: { created_at: 'DESC' },
            take: limit,
        });
    }
}
