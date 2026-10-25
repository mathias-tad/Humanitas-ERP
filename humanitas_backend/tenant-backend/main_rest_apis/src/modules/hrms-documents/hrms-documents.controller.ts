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

@Controller('hrms/documents')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('hrms')
export class HrmsDocumentsController {
  constructor(private readonly documentsService: HrmsDocumentsService) {}

  @Get()
  @RequirePermissions('view_employee_documents', 'view_my_documents')
  async getDocuments(
    @Request() req: any,
    @Query() query: DocumentsFilterDto,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const userRole = req.user.role?.toLowerCase() || '';
    const permissions: string[] = req.user.permissions || [];

    const isPrivileged =
      ['admin', 'administrator', 'owner', 'manager'].includes(userRole) ||
      permissions.includes('view_employee_documents');

    // Scoping fallback
    query.company_id = query.company_id || headerCompanyId;
    query.branch_id = query.branch_id || headerBranchId;

    // Normal staff are strictly confined to their own documents
    if (!isPrivileged) {
      query.userId = req.user.id;
    }

    return this.documentsService.getDocuments(tenantId, query);
  }

  @Get('expirations')
  @RequirePermissions('view_employee_documents')
  async getExpirations(
    @Request() req: any,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string,
  ) {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const company_id = queryCompanyId || headerCompanyId;
    const branch_id = queryBranchId || headerBranchId;
    return this.documentsService.getExpiringDocumentsSummary(tenantId, { company_id, branch_id });
  }

  @Get('templates')
  @RequirePermissions('view_employee_documents', 'generate_employee_letters')
  async getTemplates(
    @Request() req: any,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string,
  ) {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const company_id = queryCompanyId || headerCompanyId;
    const branch_id = queryBranchId || headerBranchId;
    return this.documentsService.getLetterTemplates(tenantId, { company_id, branch_id });
  }

  @Get('templates/:id')
  @RequirePermissions('view_employee_documents', 'generate_employee_letters')
  async getTemplateById(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    return this.documentsService.getLetterTemplateById(tenantId, id);
  }

  @Post('templates')
  @RequirePermissions('manage_letter_templates')
  async createTemplate(@Request() req: any, @Body() dto: CreateLetterTemplateDto) {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    return this.documentsService.createLetterTemplate(tenantId, dto);
  }

  @Put('templates/:id')
  @RequirePermissions('manage_letter_templates')
  async updateTemplate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateLetterTemplateDto,
  ) {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    return this.documentsService.updateLetterTemplate(tenantId, id, dto);
  }

  @Post('generate-letter')
  @RequirePermissions('generate_employee_letters')
  async generateLetter(@Request() req: any, @Body() dto: GenerateLetterDto) {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const issuerUserId = req.user.id;
    return this.documentsService.generateLetter(tenantId, dto, issuerUserId);
  }

  @Post()
  @RequirePermissions('manage_employee_documents', 'view_my_documents')
  async createDocument(@Request() req: any, @Body() dto: CreateDocumentDto) {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const userRole = req.user.role?.toLowerCase() || '';
    const permissions: string[] = req.user.permissions || [];

    const isPrivileged =
      ['admin', 'administrator', 'owner', 'manager'].includes(userRole) ||
      permissions.includes('manage_employee_documents');

    // If not manager/admin, user can only upload for themselves
    if (!isPrivileged && dto.userId !== req.user.id) {
      throw new ForbiddenException('You are not authorized to upload documents for other employees');
    }

    return this.documentsService.createDocument(tenantId, dto, req.user.id);
  }

  @Get(':id')
  @RequirePermissions('view_employee_documents', 'view_my_documents')
  async getDocumentById(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const doc = await this.documentsService.getDocumentById(tenantId, id);

    const userRole = req.user.role?.toLowerCase() || '';
    const permissions: string[] = req.user.permissions || [];
    const isPrivileged =
      ['admin', 'administrator', 'owner', 'manager'].includes(userRole) ||
      permissions.includes('view_employee_documents');

    if (!isPrivileged && doc.user_id !== req.user.id) {
      throw new ForbiddenException('You are not authorized to view this document');
    }

    return doc;
  }

  @Patch(':id/verify')
  @RequirePermissions('verify_employee_documents')
  async verifyDocument(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: VerifyDocumentDto,
  ) {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const verifierUserId = req.user.id;
    return this.documentsService.verifyDocument(tenantId, id, dto, verifierUserId);
  }

  @Delete(':id')
  @RequirePermissions('manage_employee_documents')
  async deleteDocument(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    return this.documentsService.deleteDocument(tenantId, id);
  }
}
