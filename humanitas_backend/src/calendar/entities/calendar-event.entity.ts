import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

export type EventCategory =
  | 'common'
  | 'workforce'
  | 'projects'
  | 'commercial'
  | 'financial';

@Entity('calendar_events')
@Index(['tenantId', 'startDate'])
@Index(['tenantId', 'companyId', 'branchId'])
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Tenant isolation */
  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'company_id', nullable: true })
  companyId: string;

  @Column({ name: 'branch_id', nullable: true })
  branchId: string;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  /** Core event data */
  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({ name: 'all_day', default: false })
  allDay: boolean;

  /** Module integration */
  @Column({
    type: 'enum',
    enum: ['common', 'workforce', 'projects', 'commercial', 'financial'],
    default: 'common',
  })
  category: EventCategory;

  /** Source module key e.g. 'attendance', 'leave', 'recruitment', 'pms', 'payroll' */
  @Column({ name: 'module_key', nullable: true })
  moduleKey: string;

  /** Source record ID in originating module (null for manual events) */
  @Column({ name: 'source_id', nullable: true })
  sourceId: string;

  /** Slug name of event type: 'shift', 'leave', 'holiday', 'meeting', 'deadline', etc. */
  @Column({ name: 'event_type', default: 'event' })
  eventType: string;

  @Column({ default: '#3B82F6' })
  color: string;

  @Column({ nullable: true })
  location: string;

  /** Deep-link back to source module page */
  @Column({ name: 'route_url', nullable: true })
  routeUrl: string;

  @Column({ nullable: true })
  status: string;

  @Column({ nullable: true })
  priority: string;

  /** Whether non-attendees can see this event */
  @Column({ name: 'is_public', default: true })
  isPublic: boolean;

  /** iCal-style recurrence rule e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR */
  @Column({ name: 'recurrence_rule', type: 'text', nullable: true })
  recurrenceRule: string;

  /** Creator employee/user ID */
  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'created_by_name', nullable: true })
  createdByName: string;

  /** Attendees JSON array of user IDs */
  @Column({ name: 'attendee_ids', type: 'json', nullable: true })
  attendeeIds: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
