import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { FastifyRequest, FastifyReply } from 'fastify';
import { UsersService } from './users.service';
import {
  UpdateProfileDto,
  ChangePasswordDto,
  CreateUserDto,
  UpdateUserDto,
} from './dto/update-profile.dto';
import { UpdateManagerDto } from './dto/update-manager.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    sub: string;
    tenantSlug: string;
    email: string;
    role: string;
  };
}

@ApiTags('Users')
@Controller('users')
@RequireModule('hrms')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req: AuthenticatedRequest) {
    try {
      return await this.usersService.getProfile(
        req.user.sub,
        req.user.tenantSlug,
      );
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    try {
      return await this.usersService.updateProfile(
        req.user.sub,
        req.user.tenantSlug,
        dto,
      );
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    try {
      return await this.usersService.changePassword(
        req.user.sub,
        req.user.tenantSlug,
        dto,
      );
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload profile avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadAvatar(@Req() req: AuthenticatedRequest) {
    try {
      // Get the multipart file from the request
      const data = await (req as any).file();

      if (!data) {
        throw new BadRequestException('No file uploaded');
      }

      // Read file buffer
      const buffer = await data.toBuffer();

      if (!buffer || buffer.length === 0) {
        throw new BadRequestException('Empty file uploaded');
      }

      const file = {
        data: buffer,
        filename: data.filename || 'avatar.png',
        mimetype: data.mimetype || 'image/png',
      };

      console.log('Uploading avatar:', {
        userId: req.user.sub,
        tenantSlug: req.user.tenantSlug,
        filename: file.filename,
        size: buffer.length,
      });

      return await this.usersService.uploadAvatar(
        req.user.sub,
        req.user.tenantSlug,
        file,
      );
    } catch (error) {
      console.error('Avatar upload error:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to upload avatar: ${error.message}`,
      );
    }
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Delete profile avatar' })
  async deleteAvatar(@Req() req: AuthenticatedRequest) {
    try {
      return await this.usersService.deleteAvatar(
        req.user.sub,
        req.user.tenantSlug,
      );
    } catch (error) {
      console.error('Delete avatar error:', error);
      throw error;
    }
  }

  // User Management Endpoints
  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @RequirePermissions('view_users', 'view_roster')
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('company_id') companyId?: string,
    @Query('branch_id') branchId?: string,
  ) {
    const activeCompanyId = companyId || (req.headers['x-company-id'] as string) || undefined;
    const activeBranchId = branchId || (req.headers['x-branch-id'] as string) || undefined;
    return this.usersService.findAllUsers(req.user.tenantSlug, activeCompanyId, activeBranchId);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get basic user list for dropdowns' })
  // No @RequirePermissions means any authenticated user can access
  async findBasicList(
    @Req() req: AuthenticatedRequest,
    @Query('company_id') companyId?: string,
    @Query('branch_id') branchId?: string,
  ) {
    const activeCompanyId = companyId || (req.headers['x-company-id'] as string) || undefined;
    const activeBranchId = branchId || (req.headers['x-branch-id'] as string) || undefined;
    return this.usersService.getBasicUsers(req.user.tenantSlug, activeCompanyId, activeBranchId);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Get current user permissions' })
  async getMyPermissions(@Req() req: AuthenticatedRequest) {
    return this.usersService.getUserPermissions(
      req.user.tenantSlug,
      req.user.sub,
    );
  }

  @Get('dashboard-stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats(
    @Req() req: AuthenticatedRequest,
    @Query('company_id') companyId?: string,
    @Query('branch_id') branchId?: string,
  ) {
    const activeCompanyId = companyId || (req.headers['x-company-id'] as string) || undefined;
    const activeBranchId = branchId || (req.headers['x-branch-id'] as string) || undefined;
    return this.usersService.getDashboardStats(req.user.tenantSlug, activeCompanyId, activeBranchId);
  }

  @Get('home-dashboard')
  @ApiOperation({ summary: 'Get home dashboard data' })
  async getHomeDashboard(
    @Req() req: AuthenticatedRequest,
    @Query('company_id') companyId?: string,
    @Query('branch_id') branchId?: string,
  ) {
    const activeCompanyId = companyId || (req.headers['x-company-id'] as string) || undefined;
    const activeBranchId = branchId || (req.headers['x-branch-id'] as string) || undefined;
    return this.usersService.getHomeDashboardData(req.user.tenantSlug, activeCompanyId, activeBranchId);
  }

  @Get('org-chart')
  @ApiOperation({ summary: 'Get organizational chart hierarchy' })
  @ApiQuery({
    name: 'department',
    required: false,
    type: String,
    description: 'Filter by department',
  })
  @RequirePermissions('view_users')
  async getOrgChart(
    @Req() req: AuthenticatedRequest,
    @Query('department') department?: string,
  ) {
    return this.usersService.getOrgChartTree(req.user.tenantSlug, department);
  }

  @Get(':id/reporting-chain')
  @ApiOperation({ summary: 'Get user reporting chain and direct reports' })
  @RequirePermissions('view_users')
  async getReportingChain(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.getReportingChain(id, req.user.tenantSlug);
  }

  @Patch(':id/manager')
  @ApiOperation({ summary: 'Update user reporting manager' })
  @RequirePermissions('edit_users')
  async updateManager(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateManagerDto,
  ) {
    return this.usersService.updateManager(id, dto.managerId, req.user.tenantSlug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  @RequirePermissions('view_users')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.usersService.findUserById(req.user.tenantSlug, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new user' })
  @RequirePermissions('create_users')
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateUserDto) {
    return this.usersService.createUser(req.user.tenantSlug, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @RequirePermissions('edit_users')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(req.user.tenantSlug, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete or suspend user' })
  @ApiQuery({
    name: 'permanent',
    required: false,
    type: Boolean,
    description: 'Permanently delete user',
  })
  @RequirePermissions('delete_users')
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('permanent') permanent?: string,
  ) {
    const isPermanent = permanent === 'true';
    return this.usersService.deleteUser(req.user.tenantSlug, id, isPermanent);
  }

  // User Attachments Endpoints

  @Get('me/attachments')
  @ApiOperation({ summary: 'Get own attachments' })
  async getMyAttachments(@Req() req: AuthenticatedRequest) {
    return this.usersService.getUserAttachments(
      req.user.tenantSlug,
      req.user.sub,
    );
  }

  @Get(':id/attachments')
  @ApiOperation({ summary: 'Get user attachments' })
  @RequirePermissions('view_user_attachments')
  async getUserAttachments(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.getUserAttachments(req.user.tenantSlug, id);
  }

  @Post(':id/attachments')
  @ApiOperation({ summary: 'Upload attachment for user' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        category: {
          type: 'string',
          enum: ['cv', 'id_document', 'contract', 'certificate', 'other'],
        },
        description: { type: 'string' },
      },
    },
  })
  @RequirePermissions('manage_user_attachments')
  async uploadUserAttachment(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    try {
      const data = await (req as any).file();

      if (!data) {
        throw new BadRequestException('No file uploaded');
      }

      const buffer = await data.toBuffer();

      if (!buffer || buffer.length === 0) {
        throw new BadRequestException('Empty file uploaded');
      }

      const file = {
        data: buffer,
        filename: data.filename || 'document.pdf',
        mimetype: data.mimetype || 'application/pdf',
      };

      // Get category and description from form fields
      const category = data.fields?.category?.value || 'other';
      const description = data.fields?.description?.value || '';

      return await this.usersService.uploadUserAttachment(
        req.user.tenantSlug,
        id,
        req.user.sub,
        file,
        category,
        description,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to upload attachment: ${error.message}`,
      );
    }
  }

  @Delete('attachments/:attachmentId')
  @ApiOperation({ summary: 'Delete user attachment' })
  @RequirePermissions('manage_user_attachments')
  async deleteUserAttachment(
    @Req() req: AuthenticatedRequest,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.usersService.deleteUserAttachment(
      req.user.tenantSlug,
      attachmentId,
    );
  }

  @Get(':id/effective-allowances')
  @ApiOperation({ summary: 'Get user effective allowances (category + overrides)' })
  async getEffectiveAllowances(
    @Req() req: AuthenticatedRequest,
    @Param('id') userId: string,
  ) {
    const allowances = await this.usersService.getUserEffectiveAllowances(
      req.user.tenantSlug,
      userId,
    );

    // Check if user has edit_payroll permission
    // For now, we'll allow admins and owners to edit
    const canEdit = req.user.role === 'admin' || req.user.role === 'owner';

    return {
      ...allowances,
      canEdit,
    };
  }

  @Patch(':id/override-allowance')
  @RequirePermissions('edit_payroll')
  @ApiOperation({ summary: 'Override user allowance (requires edit_payroll permission)' })
  async overrideAllowance(
    @Req() req: AuthenticatedRequest,
    @Param('id') userId: string,
    @Body() dto: { type: string; tier: string; customPercent?: number },
  ) {
    return this.usersService.setAllowanceOverride(
      req.user.tenantSlug,
      userId,
      dto,
    );
  }

  // Category Allowances Management
  @Get('categories/:categoryId/allowances')
  @ApiOperation({ summary: 'Get all allowances for a category' })
  @RequirePermissions('edit_payroll')
  async getCategoryAllowances(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
  ) {
    return this.usersService.getCategoryAllowances(req.user.tenantSlug, categoryId);
  }

  @Post('categories/:categoryId/allowances')
  @ApiOperation({ summary: 'Add allowance to category' })
  @RequirePermissions('edit_payroll')
  async addCategoryAllowance(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
    @Body() dto: { income_type_id: string; amount: number },
  ) {
    return this.usersService.addCategoryAllowance(req.user.tenantSlug, categoryId, dto);
  }

  @Delete('categories/allowances/:allowanceId')
  @ApiOperation({ summary: 'Delete category allowance' })
  @RequirePermissions('edit_payroll')
  async deleteCategoryAllowance(
    @Req() req: AuthenticatedRequest,
    @Param('allowanceId') allowanceId: string,
  ) {
    return this.usersService.deleteCategoryAllowance(req.user.tenantSlug, allowanceId);
  }
}
