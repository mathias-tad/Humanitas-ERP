import { IsString, IsOptional, IsUUID, IsArray, IsNotEmpty } from 'class-validator';

export class CreateTeamDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsUUID()
    @IsOptional()
    leader_id?: string;

    @IsArray()
    @IsUUID('4', { each: true })
    @IsOptional()
    member_ids?: string[];
}

export class UpdateTeamDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsUUID()
    @IsOptional()
    leader_id?: string;
}

export class AddTeamMemberDto {
    @IsUUID()
    @IsNotEmpty()
    user_id: string;
}
