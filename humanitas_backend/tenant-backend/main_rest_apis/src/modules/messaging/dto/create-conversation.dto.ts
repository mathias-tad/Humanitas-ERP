import { IsNotEmpty, IsArray, IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateConversationDto {
    @IsNotEmpty()
    @IsEnum(['direct', 'group', 'channel', 'broadcast'])
    type: 'direct' | 'group' | 'channel' | 'broadcast';

    @IsOptional()
    @IsArray()
    participantIds?: string[];

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    avatarUrl?: string;

    @IsOptional()
    @IsBoolean()
    onlyAdminsCanPost?: boolean;

    @IsOptional()
    @IsString()
    initialMessage?: string;
}
