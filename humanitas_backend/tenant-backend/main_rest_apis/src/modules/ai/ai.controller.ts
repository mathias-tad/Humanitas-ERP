import { Controller, Post, Get, Put, Delete, Body, Query, Param, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { TenantAiKnowledgeService } from './services/tenant-ai-knowledge.service';
import { CreateKnowledgeDocumentDto, UpdateKnowledgeDocumentDto, SearchKnowledgeDto } from './dto/tenant-knowledge.dto';
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
  constructor(
    private readonly aiService: AiService,
    private readonly knowledgeService: TenantAiKnowledgeService,
  ) {}

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

  // ─── Tenant Company Knowledge Vault Endpoints (Direct Citation RAG) ───────

  @Get('knowledge-vault/documents')
  @Permissions('use_ai')
  async getKnowledgeVaultDocuments(
    @Req() req,
    @Query('q') query?: string,
    @Query('category') category?: string,
    @Query('company_id') companyId?: string,
    @Query('branch_id') branchId?: string,
  ) {
    const user = req.user;
    return this.knowledgeService.getDocuments(user.tenantSlug, query, category, companyId, branchId);
  }

  @Get('knowledge-vault/documents/:id')
  @Permissions('use_ai')
  async getKnowledgeVaultDocumentById(@Req() req, @Param('id') id: string) {
    const user = req.user;
    return this.knowledgeService.getDocumentById(user.tenantSlug, id);
  }

  @Post('knowledge-vault/documents')
  @Permissions('manage_ai_settings', 'manage_ai', 'manage_system', '*')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async createKnowledgeVaultDocument(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    const user = req.user;
    const dto: CreateKnowledgeDocumentDto = {
      title: body.title,
      category: body.category,
      content_type: file ? 'file' : (body.content_type || 'text'),
      raw_text: body.raw_text,
      summary: body.summary,
      company_id: body.company_id,
      branch_id: body.branch_id,
      metadata: body.metadata ? (typeof body.metadata === 'string' ? JSON.parse(body.metadata) : body.metadata) : {},
      is_active: body.is_active !== undefined ? (body.is_active === true || body.is_active === 'true') : true,
    };
    return this.knowledgeService.createDocument(
      user.tenantSlug,
      user.sub,
      dto,
      file ? { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname, size: file.size } : undefined,
    );
  }

  @Put('knowledge-vault/documents/:id')
  @Permissions('manage_ai_settings', 'manage_ai', 'manage_system', '*')
  async updateKnowledgeVaultDocument(
    @Req() req,
    @Param('id') id: string,
    @Body() body: UpdateKnowledgeDocumentDto,
  ) {
    const user = req.user;
    return this.knowledgeService.updateDocument(user.tenantSlug, id, body);
  }

  @Delete('knowledge-vault/documents/:id')
  @Permissions('manage_ai_settings', 'manage_ai', 'manage_system', '*')
  async deleteKnowledgeVaultDocument(@Req() req, @Param('id') id: string) {
    const user = req.user;
    return this.knowledgeService.deleteDocument(user.tenantSlug, id);
  }

  @Post('knowledge-vault/search')
  @Permissions('use_ai')
  async searchKnowledgeVault(@Req() req, @Body() body: SearchKnowledgeDto) {
    const user = req.user;
    return this.knowledgeService.searchKnowledge(
      user.tenantSlug,
      body.query,
      body.category,
      body.company_id,
      body.branch_id,
      body.limit || 5,
    );
  }
}
