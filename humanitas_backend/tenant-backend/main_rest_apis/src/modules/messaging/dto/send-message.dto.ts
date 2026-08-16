import { IsNotEmpty, IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';

export class SendMessageDto {
    @IsNotEmpty()
    @IsUUID()
    conversationId: string;

    @IsOptional()
    @IsString()
    content?: string;

    @IsOptional()
    @IsEnum(['text', 'image', 'file', 'voice', 'video', 'sticker', 'system'])
    messageType?: string;

    @IsOptional()
    @IsUUID()
    replyToId?: string;

    /** Set when forwarding — original message id */
    @IsOptional()
    @IsUUID()
    forwardedFromId?: string;

    @IsOptional()
    @IsString()
    attachmentUrl?: string;
}

export class EditMessageDto {
    @IsNotEmpty()
    @IsString()
    content: string;
}

export class ReactMessageDto {
    @IsNotEmpty()
    @IsString()
    emoji: string;
}

export class UpdateGroupDto {
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
    onlyAdminsCanPost?: boolean;
}

export class AddMembersDto {
    @IsNotEmpty()
    @IsString({ each: true })
    userIds: string[];
}

export class UpdateMemberRoleDto {
    @IsNotEmpty()
    @IsEnum(['admin', 'member'])
    role: 'admin' | 'member';
}

export class DeleteMessageQueryDto {
    @IsOptional()
    forEveryone?: any;
}

export class SearchUsersQueryDto {
    @IsOptional()
    @IsString()
    q?: string;
}
