import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('acting_assignments')
export class ActingAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The employee who is covering (receives the acting allowance) */
  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId: string;

  /** The employee whose role is being covered */
  @Column({ name: 'target_user_id', type: 'uuid' })
  targetUserId: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
