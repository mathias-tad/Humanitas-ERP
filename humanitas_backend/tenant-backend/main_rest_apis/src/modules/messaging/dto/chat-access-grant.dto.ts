import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RequestChatAccessDto {
    @IsString()
    @IsNotEmpty()
    targetUserId: string;

    @IsString()
    @IsNotEmpty()
    reason: string;
}

export type ChatAccessGrantDuration = '1h' | '24h' | '3d' | '7d' | '30d' | 'forever';

export class RespondChatAccessDto {
    @IsEnum(['approve', 'reject'])
    action: 'approve' | 'reject';

    @IsOptional()
    @IsEnum(['1h', '24h', '3d', '7d', '30d', 'forever'])
    duration?: ChatAccessGrantDuration;

    @IsOptional()
    @IsString()
    note?: string;
}

export class RoleRestrictionItemDto {
    @IsString()
    @IsNotEmpty()
    role: string;

    @IsBoolean()
    isRestricted: boolean;

    @IsOptional()
    @IsString()
    triagePrompt?: string;
}

export class SetRoleRestrictionsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RoleRestrictionItemDto)
    restrictions: RoleRestrictionItemDto[];
}

export class ToggleChatOverrideDto {
    @IsBoolean()
    allowOverride: boolean;
}

export class GrantDirectAccessDto {
    @IsString()
    @IsNotEmpty()
    employeeId: string;

    @IsOptional()
    @IsEnum(['1h', '24h', '3d', '7d', '30d', 'forever'])
    duration?: ChatAccessGrantDuration;

    @IsOptional()
    @IsString()
    note?: string;
}
