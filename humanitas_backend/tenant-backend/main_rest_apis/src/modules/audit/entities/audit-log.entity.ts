import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    user_id: string; // Who performed the action

    @Column()
    action: string; // e.g., 'CREATE_SHIFT', 'ASSIGN_SCHEDLE'

    @Column()
    target_id: string; // ID of the object affected (Shift ID, User ID schema)

    @Column('jsonb', { nullable: true })
    details: any; // Snapshot of changes or params

    @CreateDateColumn()
    created_at: Date;
}
