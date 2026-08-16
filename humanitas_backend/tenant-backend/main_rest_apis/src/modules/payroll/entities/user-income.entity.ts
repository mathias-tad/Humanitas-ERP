import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('user_incomes')
@Index(['userId'])
export class UserIncome {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'income_type_id', type: 'uuid' })
  incomeTypeId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  amount: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /**
   * NULL = inherit taxability from the parent IncomeType.
   * TRUE/FALSE = override per this specific assignment.
   */
  @Column({ name: 'is_taxable', type: 'boolean', nullable: true })
  isTaxable: boolean;

  /** Optional label for additional assignments of the same income type */
  @Column({ type: 'varchar', length: 255, nullable: true })
  alias: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
