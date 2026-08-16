import {
    Entity,
    PrimaryColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Task } from './task.entity';

export enum DependencyType {
    FINISH_TO_START = 'finish-to-start',
    START_TO_START = 'start-to-start',
    FINISH_TO_FINISH = 'finish-to-finish',
}

@Entity('pms_task_dependencies')
export class TaskDependency {
    @PrimaryColumn('uuid')
    task_id: string;

    @PrimaryColumn('uuid')
    depends_on_task_id: string;

    @ManyToOne(() => Task, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;

    @ManyToOne(() => Task, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'depends_on_task_id' })
    dependsOnTask: Task;

    @Column({
        type: 'enum',
        enum: DependencyType,
        default: DependencyType.FINISH_TO_START,
    })
    dependency_type: DependencyType;
}
