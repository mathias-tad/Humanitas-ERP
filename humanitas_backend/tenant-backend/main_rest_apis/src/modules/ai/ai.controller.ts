import { Controller, Post, Get, Body, Query, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, PERMISSIONS_KEY } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { SetMetadata } from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  currentRoute?: string;

  @IsString()
  @IsOptional()
  currentModule?: string;

  @IsString()
  @IsOptional()
  platform?: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @Permissions('use_ai')
  async chat(@Req() req, @Body() body: ChatRequestDto) {
    const user = req.user;
    return this.aiService.processRequest(
      user.tenantId,
      user.tenantSlug,
      user.sub,
      user.role,
      body.message,
      user.full_name || 'User',
      body.conversationId,
      body.currentRoute,
      body.currentModule,
      body.platform,
    );
  }

  @Post('chat-with-file')
  @Permissions('use_ai')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async chatWithFile(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ChatRequestDto,
  ) {
    const user = req.user;
    if (!file) {
      return this.aiService.processRequest(
        user.tenantId,
        user.tenantSlug,
        user.sub,
        user.role,
        body.message,
        user.full_name || 'User',
        body.conversationId,
        body.currentRoute,
        body.currentModule,
        body.platform,
      );
    }
    return this.aiService.processRequestWithFile(
      user.tenantId,
      user.tenantSlug,
      user.sub,
      user.role,
      body.message || '',
      user.full_name || 'User',
      file.buffer,
      file.mimetype,
      file.originalname,
      body.conversationId,
      body.currentRoute,
      body.currentModule,
      body.platform,
    );
  }

  @Get('knowledge')
  @Permissions('use_ai')
  async getKnowledge(
    @Req() req,
    @Query('q') query?: string,
    @Query('module') moduleKey?: string,
    @Query('platform') platform?: string,
  ) {
    const user = req.user;
    return this.aiService.getKnowledgeEntries(user.tenantSlug, query, moduleKey, platform);
  }

  @Post('knowledge')
  @Permissions('manage_system', 'manage_ai', '*')
  async registerKnowledgeEntry(@Req() req, @Body() entry: any) {
    const user = req.user;
    return this.aiService.upsertKnowledgeEntry(user.tenantSlug, entry);
  }

  @Get('audit-logs')
  @Permissions('view_logs', 'manage_system', '*')
  async getAuditLogs(@Req() req, @Query('limit') limit?: number) {
    const user = req.user;
    return this.aiService.getAuditLogs(user.tenantSlug, limit ? Number(limit) : 50);
  }
}
