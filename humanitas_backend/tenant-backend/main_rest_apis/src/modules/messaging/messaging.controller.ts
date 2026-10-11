import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, Query, UseGuards, Request,
    BadRequestException,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { MessagingService } from './messaging.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import {
    SendMessageDto, EditMessageDto, ReactMessageDto,
    UpdateGroupDto, AddMembersDto, UpdateMemberRoleDto,
    DeleteMessageQueryDto, SearchUsersQueryDto,
} from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('messaging')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('use_messaging')
export class MessagingController {
    constructor(private readonly messagingService: MessagingService) { }

    // ─────────────────────── CONVERSATIONS ───────────────────────
    @Post('conversations')
    create(@Request() req, @Body() dto: CreateConversationDto) {
        return this.messagingService.createConversation(req.user.tenantId, req.user.sub, dto);
    }

    @Get('conversations')
    findAll(@Request() req) {
        return this.messagingService.getConversations(req.user.tenantId, req.user.sub);
    }

    @Get('conversations/:id')
    findOne(@Request() req, @Param('id') id: string) {
        return this.messagingService.getConversation(req.user.tenantId, req.user.sub, id);
    }

    @Patch('conversations/:id')
    updateConversation(@Request() req, @Param('id') id: string, @Body() dto: UpdateGroupDto) {
        return this.messagingService.updateConversation(req.user.tenantId, req.user.sub, id, dto);
    }

    @Post('conversations/:id/members')
    addMembers(@Request() req, @Param('id') id: string, @Body() dto: AddMembersDto) {
        return this.messagingService.addMembers(req.user.tenantId, req.user.sub, id, dto);
    }

    @Delete('conversations/:id/members/:userId')
    removeMember(@Request() req, @Param('id') id: string, @Param('userId') userId: string) {
        return this.messagingService.removeMember(req.user.tenantId, req.user.sub, id, userId);
    }

    @Patch('conversations/:id/members/:userId/role')
    updateMemberRole(
        @Request() req,
        @Param('id') id: string,
        @Param('userId') userId: string,
        @Body() dto: UpdateMemberRoleDto,
    ) {
        return this.messagingService.updateMemberRole(req.user.tenantId, req.user.sub, id, userId, dto);
    }

    @Post('conversations/:id/read')
    markAsRead(@Request() req, @Param('id') conversationId: string) {
        return this.messagingService.markConversationAsRead(req.user.tenantId, req.user.sub, conversationId);
    }

    // ─────────────────────── MESSAGES ─────────────────────────────
    @Get('conversations/:id/messages')
    getMessages(@Request() req, @Param('id') id: string) {
        return this.messagingService.getMessages(req.user.tenantId, req.user.sub, id);
    }

    @Post('messages')
    sendMessage(@Request() req, @Body() dto: SendMessageDto) {
        return this.messagingService.sendMessage(req.user.tenantId, req.user.sub, dto);
    }

    @Patch('messages/:id')
    editMessage(@Request() req, @Param('id') id: string, @Body() dto: EditMessageDto) {
        return this.messagingService.editMessage(req.user.tenantId, req.user.sub, id, dto);
    }

    @Delete('messages/:id')
    deleteMessage(
        @Request() req,
        @Param('id') id: string,
        @Query() query: DeleteMessageQueryDto,
    ) {
        const isForEveryone = query.forEveryone === 'true' || query.forEveryone === '1' || (query.forEveryone as any) === true;
        return this.messagingService.deleteMessage(
            req.user.tenantId, req.user.sub, id,
            isForEveryone,
        );
    }

    @Post('messages/:id/forward')
    forwardMessage(
        @Request() req,
        @Param('id') id: string,
        @Body() body: { conversationIds: string[] },
    ) {
        return this.messagingService.forwardMessage(req.user.tenantId, req.user.sub, id, body.conversationIds);
    }

    @Post('conversations/:id/avatar')
    async uploadConversationAvatar(@Request() req, @Param('id') id: string) {
        try {
            // In NestJS+Fastify the decorated @Request() is already the Fastify request
            const data = await req.file();
            if (!data) throw new BadRequestException('No file uploaded');

            const buffer = await data.toBuffer();
            if (!buffer || buffer.length === 0) throw new BadRequestException('Empty file');

            const ext = path.extname(data.filename || '.png') || '.png';
            const filename = `conv_${id}_${Date.now()}${ext}`;
            const uploadsDir = path.join(process.cwd(), 'uploads');
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
            await fs.promises.writeFile(path.join(uploadsDir, filename), buffer);

            const avatarUrl = `/uploads/${filename}`;
            return this.messagingService.updateConversation(
                req.user.tenantId, req.user.sub, id,
                { avatarUrl } as UpdateGroupDto,
            );
        } catch (err) {
            if (err instanceof BadRequestException) throw err;
            throw new BadRequestException(`Failed to upload avatar: ${err.message}`);
        }
    }

    @Post('messages/:id/react')
    reactToMessage(@Request() req, @Param('id') id: string, @Body() dto: ReactMessageDto) {
        return this.messagingService.reactToMessage(req.user.tenantId, req.user.sub, id, dto);
    }

    @Post('upload')
    async uploadFile(@Request() req) {
        try {
            const data = await req.file();
            if (!data) throw new BadRequestException('No file uploaded');
            const buffer = await data.toBuffer();
            if (!buffer || buffer.length === 0) throw new BadRequestException('Empty file');

            const ext = path.extname(data.filename || '.bin') || '.bin';
            const filename = `msg_${Date.now()}${ext}`;
            const uploadsDir = path.join(process.cwd(), 'uploads');
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
            await fs.promises.writeFile(path.join(uploadsDir, filename), buffer);

            return { url: `/uploads/${filename}`, filename };
        } catch (err) {
            if (err instanceof BadRequestException) throw err;
            throw new BadRequestException(`Upload failed: ${err.message}`);
        }
    }

    // ─────────────────────── USERS SEARCH ─────────────────────────
    @Get('users/search')
    searchUsers(@Request() req, @Query() query: SearchUsersQueryDto) {
        return this.messagingService.searchUsers(req.user.tenantId, query.q ?? '', req.user.sub);
    }

    // ─────────────────────── SETTINGS ─────────────────────────────
    @Get('settings')
    getSettings(@Request() req) {
        return this.messagingService.getSettings(req.user.tenantId, req.user.sub);
    }

    @Patch('settings')
    updateSettings(@Request() req, @Body() dto: any) {
        return this.messagingService.updateSettings(req.user.tenantId, req.user.sub, dto);
    }
}
