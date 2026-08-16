import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('income_types')
export class IncomeType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_taxable', type: 'boolean', default: true })
  isTaxable: boolean;

  @Column({ name: 'is_pensionable', type: 'boolean', default: false })
  isPensionable: boolean;

  @Column({ name: 'calculation_type', type: 'varchar', length: 20, default: 'fixed' })
  calculationType: string;

  @Column({ name: 'tax_rate', type: 'varchar', length: 50, default: 'standard' })
  taxRate: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_category_specific', type: 'boolean', default: false })
  isCategorySpecific: boolean;

  @Column({ name: 'universal_fixed_amount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  universalFixedAmount: number;

  @Column({ name: 'universal_percentage_value', type: 'decimal', precision: 5, scale: 2, nullable: true })
  universalPercentageValue: number;

  @Column({ name: 'universal_calculation_mode', type: 'varchar', length: 20, default: 'both_highest' })
  universalCalculationMode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
