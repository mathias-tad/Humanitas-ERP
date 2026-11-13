import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { EmployeeCategoryService } from './employee-category.service';
import { EmployeeCategory } from './entities/employee-category.entity';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    sub: string;
    tenantSlug: string;
    role: string;
  };
}

@ApiTags('Employee Categories')
@Controller('employee-categories')
@RequireModule('users') // Group under Settings URL for UX
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@ApiBearerAuth()
export class EmployeeCategoryController {
  constructor(private readonly categoryService: EmployeeCategoryService) {
    console.log('[DEBUG] EmployeeCategoryController Initialized');
  }

  @Get()
  @ApiOperation({ summary: 'List all employee categories' })
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.categoryService.findAll(req.user.tenantSlug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single employee category by ID' })
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.categoryService.findOne(req.user.tenantSlug, id);
  }

  @Post()
  @RequirePermissions('manage_settings')
  @ApiOperation({ summary: 'Create a new employee category' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: Partial<EmployeeCategory>,
  ) {
    return this.categoryService.create(req.user.tenantSlug, dto);
  }

  @Patch(':id')
  @RequirePermissions('manage_settings')
  @ApiOperation({ summary: 'Update an employee category' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: Partial<EmployeeCategory>,
  ) {
    return this.categoryService.update(req.user.tenantSlug, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('manage_settings')
  @ApiOperation({ summary: 'Delete an employee category' })
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.categoryService.remove(req.user.tenantSlug, id);
  }
}
