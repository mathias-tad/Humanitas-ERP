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
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    sub: string;
    tenantSlug: string;
    email: string;
    role: string;
  };
}

@ApiTags('Roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) { }

  @Get()
  @ApiOperation({ summary: 'Get all roles' })
  @RequirePermissions('view_roles', 'view_dashboard', 'view_users')
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.rolesService.findAll(req.user.tenantSlug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role by id' })
  @RequirePermissions('view_roles')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.rolesService.findOne(req.user.tenantSlug, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new role' })
  @RequirePermissions('create_roles')
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(req.user.tenantSlug, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update role' })
  @RequirePermissions('edit_roles')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(req.user.tenantSlug, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete role' })
  @RequirePermissions('delete_roles')
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.rolesService.remove(req.user.tenantSlug, id);
  }

  @Patch(':id/permissions')
  @ApiOperation({ summary: 'Update role permissions' })
  @RequirePermissions('edit_roles')
  async updatePermissions(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { permissions: string[] },
  ) {
    return this.rolesService.updatePermissions(
      req.user.tenantSlug,
      id,
      body.permissions,
    );
  }
}
