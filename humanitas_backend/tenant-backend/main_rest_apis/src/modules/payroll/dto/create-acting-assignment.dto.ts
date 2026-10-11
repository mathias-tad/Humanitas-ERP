import { IsUUID, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateActingAssignmentDto {
    @ApiProperty({ description: 'ID of the actor user' })
    @IsUUID()
    @IsNotEmpty()
    actor_user_id: string;

    @ApiProperty({ description: 'ID of the target user being acted for' })
    @IsUUID()
    @IsNotEmpty()
    target_user_id: string;

    @ApiProperty({ description: 'Assignment start date (YYYY-MM-DD)' })
    @IsDateString()
    @IsNotEmpty()
    start_date: string;

    @ApiProperty({ description: 'Assignment end date (YYYY-MM-DD)' })
    @IsDateString()
    @IsNotEmpty()
    end_date: string;
}
