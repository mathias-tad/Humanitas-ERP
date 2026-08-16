import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminRole } from '../user/entities/admin-user.entity';

@ApiTags('Admin Management')
@ApiBearerAuth()
@Controller('admins')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new admin user' })
  create(@Body() createAdminDto: CreateAdminDto, @Request() req: any) {
    return this.adminService.create(createAdminDto, { role: req.user.role });
  }

  @Get()
  @ApiOperation({ summary: 'Get all admin users' })
  findAll(
    @Query('search') search?: string,
    @Query('role') role?: AdminRole,
    @Query('is_active') is_active?: string,
  ) {
    return this.adminService.findAll({
      search,
      role,
      is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get admin statistics' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get admin by ID' })
  findOne(@Param('id') id: string) {
    return this.adminService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update admin user' })
  update(@Param('id') id: string, @Body() updateAdminDto: UpdateAdminDto) {
    return this.adminService.update(id, updateAdminDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete admin user' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.adminService.remove(id, { id: req.user.sub, role: req.user.role });
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate admin user' })
  deactivate(@Param('id') id: string, @Request() req: any) {
    return this.adminService.deactivate(id, { id: req.user.sub, role: req.user.role });
  }

  @Patch(':id/activate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Activate admin user' })
  activate(@Param('id') id: string) {
    return this.adminService.activate(id);
  }
}
