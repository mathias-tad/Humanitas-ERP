import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Body,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UserRole } from './entities/user-tenant-map.entity';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ==================== ADMIN USERS (must be before :id routes) ====================

  @Post('admins/seed')
  @ApiOperation({ summary: 'Seed super admin (use only for initial setup)' })
  seedAdmin() {
    return this.userService.seedSuperAdmin();
  }

  @Get('admins/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all admin users (admin only)' })
  findAllAdmins() {
    return this.userService.findAllAdmins();
  }

  // ==================== TENANT USERS ====================

  @Get('tenant/:tenantId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users in a tenant (admin only)' })
  findByTenant(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.userService.findUsersByTenant(tenantId);
  }

  @Get('email/:email')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Find user by email across all tenants (admin only)' })
  findByEmail(@Param('email') email: string) {
    return this.userService.findUserByEmail(email);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findUserById(id);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user role (admin only)' })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('role') role: UserRole,
  ) {
    return this.userService.updateUserRole(id, role);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate user (admin only)' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.deactivateUser(id);
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate user (admin only)' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.activateUser(id);
  }
}
