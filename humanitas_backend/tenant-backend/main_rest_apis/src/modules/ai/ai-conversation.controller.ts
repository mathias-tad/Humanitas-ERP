import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AiConversationService } from './services/ai-conversation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, PERMISSIONS_KEY } from '../auth/guards/permissions.guard';
import { SetMetadata } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export class CreateConversationDto {
  @IsString()
  @IsOptional()
  title?: string;
}

@Controller('ai/history')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiConversationController {
  constructor(private readonly conversationService: AiConversationService) {}

  @Get()
  @Permissions('view_ai_history')
  async getConversations(@Req() req) {
    return this.conversationService.getConversations(req.user.tenantSlug, req.user.sub);
  }

  @Post()
  @Permissions('use_ai')
  async createConversation(@Req() req, @Body() body: CreateConversationDto) {
    return this.conversationService.createConversation(req.user.tenantSlug, req.user.sub, body.title);
  }

  @Get(':id')
  @Permissions('view_ai_history')
  async getConversation(@Req() req, @Param('id') id: string) {
    return this.conversationService.getConversation(req.user.tenantSlug, req.user.sub, id);
  }
}
