import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { HrmsDocumentsService } from './hrms-documents.service';
import {
  CreateDocumentDto,
  VerifyDocumentDto,
  DocumentsFilterDto,
  CreateLetterTemplateDto,
  UpdateLetterTemplateDto,
  GenerateLetterDto,
} from './dto/hrms-documents.dto';
import {
  UpdateSignatureDto,
  UpdateSignatureProviderDto,
} from './dto/digital-signature.dto';

@Controller('hrms/documents')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('hrms')
export class HrmsDocumentsController {
  constructor(private readonly documentsService: HrmsDocumentsService) {}

  // ── LIST & FILTER ─────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('view_employee_documents', 'view_my_documents', 'view_documents')
  async getDocuments(
    @Request() req: any,
    @Query() query: DocumentsFilterDto,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id;
    const userRole = req.user?.role?.toLowerCase() || '';
    const permissions: string[] = req.user?.permissions || [];

    const isPrivileged =
      ['admin', 'administrator', 'owner', 'manager'].includes(userRole) ||
      permissions.includes('view_employee_documents') ||
      permissions.includes('view_documents');

    query.company_id = query.company_id || headerCompanyId;
    query.branch_id = query.branch_id || headerBranchId;

    if (!isPrivileged) {
      query.userId = (req.user?.sub || req.user?.id);
    }

    return this.documentsService.getDocuments(tenantId, query);
  }

  // ── STATIC NAMED ROUTES (must precede :id routes) ────────────────────────

  @Get('expirations')
  @RequirePermissions('view_employee_documents', 'view_documents')
  async getExpirations(
    @Request() req: any,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id;
    const company_id = queryCompanyId || headerCompanyId;
    const branch_id = queryBranchId || headerBranchId;
    return this.documentsService.getExpiringDocumentsSummary(tenantId, { company_id, branch_id });
  }

  // ── Missing Documents Alerts ──────────────────────────────────────────────

  @Get('missing-alerts')
  @RequirePermissions('manage_documents', 'view_employee_documents', 'manage_employee_documents')
  async getMissingAlerts(@Request() req: any, @Headers('x-tenant-id') headerTenantId?: string) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.getMissingDocumentAlerts(tenantId);
  }

  @Get('missing-required')
  @RequirePermissions('view_employee_documents', 'manage_documents')
  async getMissingDocuments(@Request() req: any, @Headers('x-tenant-id') headerTenantId?: string) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.getMissingDocumentAlerts(tenantId);
  }

  // ── Bulk Download ────────────────────────────────────────────────────────

  @Get('bulk-download')
  @RequirePermissions('manage_documents', 'manage_employee_documents', 'view_employee_documents')
  async bulkDownloadUrls(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Query('user_id') userId?: string,
    @Query('category') category?: string,
    @Query('department') dept?: string,
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.getBulkDownloadUrls(tenantId, {
      user_id: userId,
      category,
      department: dept,
    });
  }

  // ── Bulk Letter Generation & Audit Log ────────────────────────────────────

  @Post('bulk-generate')
  @RequirePermissions('manage_employee_documents', 'manage_documents')
  async bulkGenerate(
    @Request() req: any,
    @Body() body: { template_id: string; employee_ids: string[] },
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.bulkGenerateLetters(tenantId, body.template_id, body.employee_ids);
  }

  @Get('letter-audit-log')
  @RequirePermissions('view_employee_documents', 'view_documents')
  async getLetterAuditLog(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('template_id') templateId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.getLetterAuditLog(tenantId, { from, to, template_id: templateId });
  }

  @Get('letters/audit-log')
  @RequirePermissions('view_documents', 'view_employee_documents')
  async getLettersAuditLog(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('template_id') templateId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.getLetterAuditLog(tenantId, { from, to, template_id: templateId });
  }

  @Post('letters/audit-log')
  @RequirePermissions('manage_documents', 'manage_employee_documents')
  async logLetterGen(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Body() body?: { template_id: string; template_name: string; generated_for_user_id: string; generated_by: string; document_title: string; },
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.logLetterGeneration(tenantId, body as any);
  }

  @Get('letters/letterhead')
  @RequirePermissions('view_documents', 'view_employee_documents')
  async getLetterhead(@Request() req: any, @Headers('x-tenant-id') headerTenantId?: string) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.getLetterheadConfig(tenantId);
  }

  @Put('letters/letterhead')
  @RequirePermissions('manage_documents', 'manage_employee_documents')
  async updateLetterhead(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Body() body?: any,
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.updateLetterheadConfig(tenantId, body);
  }

  // ── TEMPLATES ─────────────────────────────────────────────────────────────

  @Get('templates')
  @RequirePermissions('view_employee_documents', 'generate_employee_letters', 'view_documents')
  async getTemplates(
    @Request() req: any,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id;
    const company_id = queryCompanyId || headerCompanyId;
    const branch_id = queryBranchId || headerBranchId;
    return this.documentsService.getLetterTemplates(tenantId, { company_id, branch_id });
  }

  @Get('templates/:id')
  @RequirePermissions('view_employee_documents', 'generate_employee_letters', 'view_documents')
  async getTemplateById(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id;
    return this.documentsService.getLetterTemplateById(tenantId, id);
  }

  @Post('templates')
  @RequirePermissions('manage_letter_templates')
  async createTemplate(@Request() req: any, @Body() dto: CreateLetterTemplateDto) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id;
    return this.documentsService.createLetterTemplate(tenantId, dto);
  }

  @Put('templates/:id')
  @RequirePermissions('manage_letter_templates')
  async updateTemplate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateLetterTemplateDto,
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id;
    return this.documentsService.updateLetterTemplate(tenantId, id, dto);
  }

  @Post('generate-letter')
  @RequirePermissions('generate_employee_letters')
  async generateLetter(@Request() req: any, @Body() dto: GenerateLetterDto) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id;
    return this.documentsService.generateLetter(tenantId, dto, (req.user?.sub || req.user?.id));
  }

  // ── CREATE DOCUMENT ───────────────────────────────────────────────────────

  @Post()
  @RequirePermissions('manage_employee_documents', 'view_my_documents', 'manage_documents')
  async createDocument(@Request() req: any, @Body() dto: CreateDocumentDto) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id;
    const userRole = req.user?.role?.toLowerCase() || '';
    const permissions: string[] = req.user?.permissions || [];

    const isPrivileged =
      ['admin', 'administrator', 'owner', 'manager'].includes(userRole) ||
      permissions.includes('manage_employee_documents') ||
      permissions.includes('manage_documents');

    if (!isPrivileged && dto.userId !== (req.user?.sub || req.user?.id)) {
      throw new ForbiddenException('You are not authorized to upload documents for other employees');
    }

    return this.documentsService.createDocument(tenantId, dto, (req.user?.sub || req.user?.id));
  }

  // ── :id PARAMETERIZED ROUTES (always last) ────────────────────────────────

  @Get(':id')
  @RequirePermissions('view_employee_documents', 'view_my_documents', 'view_documents')
  async getDocumentById(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id;
    const doc = await this.documentsService.getDocumentById(tenantId, id);

    const userRole = req.user?.role?.toLowerCase() || '';
    const permissions: string[] = req.user?.permissions || [];
    const isPrivileged =
      ['admin', 'administrator', 'owner', 'manager'].includes(userRole) ||
      permissions.includes('view_employee_documents') ||
      permissions.includes('view_documents');

    if (!isPrivileged && doc.user_id !== (req.user?.sub || req.user?.id)) {
      throw new ForbiddenException('You are not authorized to view this document');
    }

    return doc;
  }

  // ── Document Versioning ───────────────────────────────────────────────────

  @Post(':id/versions')
  @RequirePermissions('manage_employee_documents', 'manage_documents')
  async addVersion(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { file_url: string; change_notes?: string; file_size?: number; file_name?: string },
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id;
    return this.documentsService.addDocumentVersion(tenantId, id, {
      file_url: body.file_url,
      file_name: body.file_name,
      uploaded_by: (req.user?.sub || req.user?.id),
      uploadedByName: req.user?.name || req.user?.full_name || req.user?.email,
      change_notes: body.change_notes,
      file_size: body.file_size,
    });
  }

  @Get(':id/versions')
  @RequirePermissions('view_employee_documents', 'view_my_documents', 'view_documents')
  async getVersions(@Request() req: any, @Param('id') id: string, @Headers('x-tenant-id') headerTenantId?: string) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.getDocumentVersions(tenantId, id);
  }

  @Patch(':id/verify')
  @RequirePermissions('verify_employee_documents')
  async verifyDocument(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: VerifyDocumentDto,
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id;
    return this.documentsService.verifyDocument(tenantId, id, dto, (req.user?.sub || req.user?.id));
  }

  @Delete(':id')
  @RequirePermissions('manage_employee_documents', 'manage_documents')
  async deleteDocument(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id;
    return this.documentsService.deleteDocument(tenantId, id);
  }
}

@Controller('hrms/letters')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('hrms')
export class HrmsLettersController {
  constructor(private readonly documentsService: HrmsDocumentsService) {}

  @Get('audit-log')
  @RequirePermissions('view_documents', 'view_employee_documents')
  async getLetterAuditLog(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('template_id') templateId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.getLetterAuditLog(tenantId, { from, to, template_id: templateId });
  }

  @Post('audit-log')
  @RequirePermissions('manage_documents', 'manage_employee_documents')
  async logLetterGen(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Body() body?: { template_id: string; template_name: string; generated_for_user_id: string; generated_by: string; document_title: string; },
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.logLetterGeneration(tenantId, body as any);
  }

  @Get('letterhead')
  @RequirePermissions('view_documents', 'view_employee_documents')
  async getLetterhead(@Request() req: any, @Headers('x-tenant-id') headerTenantId?: string) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.getLetterheadConfig(tenantId);
  }

  @Put('letterhead')
  @RequirePermissions('manage_documents', 'manage_employee_documents')
  async updateLetterhead(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Body() body?: any,
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.updateLetterheadConfig(tenantId, body);
  }

  @Post('generate-bulk')
  @RequirePermissions('manage_documents', 'manage_employee_documents')
  async bulkGenerate(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Body() body?: { template_id: string; employee_ids: string[] },
  ) {
    const tenantId = req.user?.tenantId || req.user?.tenant_id || headerTenantId;
    return this.documentsService.bulkGenerateLetters(tenantId, body!.template_id, body!.employee_ids);
  }
}

@Controller('hrms')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('hrms')
export class HrmsDigitalSignatureController {
  constructor(private readonly documentsService: HrmsDocumentsService) {}

  private getTenantId(req: any, headerTenantId?: string): string {
    return req?.user?.tenantId || req?.user?.tenant_id || headerTenantId;
  }

  // User signature endpoints (self-service)
  @Get('employees/:userId/signature')
  @RequirePermissions('view_employee_documents', 'view_my_documents')
  async getUserSignature(
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Param('userId') userId: string,
  ) {
    const tid = this.getTenantId(req, tenantId);
    return this.documentsService.getUserSignature(tid, userId);
  }

  @Put('employees/:userId/signature')
  @RequirePermissions('view_employee_documents', 'view_my_documents')
  async upsertUserSignature(
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Param('userId') userId: string,
    @Body() body: UpdateSignatureDto,
  ) {
    const tid = this.getTenantId(req, tenantId);
    return this.documentsService.upsertUserSignature(tid, userId, body.signature_url || '');
  }

  @Delete('employees/:userId/signature')
  @RequirePermissions('view_employee_documents', 'view_my_documents')
  async deleteUserSignature(
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Param('userId') userId: string,
  ) {
    const tid = this.getTenantId(req, tenantId);
    return this.documentsService.deleteUserSignature(tid, userId);
  }

  // E-Sign provider config (admin only)
  @Get('esign/config')
  @RequirePermissions('manage_documents', 'manage_employee_documents')
  async getEsignConfig(
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    const tid = this.getTenantId(req, tenantId);
    return this.documentsService.getEsignProviderConfig(tid);
  }

  @Put('esign/config')
  @RequirePermissions('manage_documents', 'manage_employee_documents')
  async updateEsignConfig(
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: UpdateSignatureProviderDto,
  ) {
    const tid = this.getTenantId(req, tenantId);
    return this.documentsService.updateEsignProviderConfig(tid, body);
  }
}

