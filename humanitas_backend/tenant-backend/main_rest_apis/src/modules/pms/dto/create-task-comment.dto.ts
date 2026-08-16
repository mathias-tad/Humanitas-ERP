import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateTaskCommentDto {
    @IsUUID()
    @IsNotEmpty()
    task_id: string;

    @IsString()
    @IsNotEmpty()
    content: string;
}
