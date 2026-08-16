import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
    UseGuards,
    Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { ActingAssignmentsService } from './acting-assignments.service';

@ApiTags('Payroll')
@Controller('payroll/acting-assignments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ActingAssignmentsController {
    constructor(private readonly actingService: ActingAssignmentsService) { }

    @Post()
    @ApiOperation({ summary: 'Create Acting Assignment' })
    @RequirePermissions('edit_payroll_settings')
    async create(@Req() req: any, @Body() body: any) {
        return this.actingService.create(req.user.tenantSlug, body);
    }

    @Get()
    @ApiOperation({ summary: 'List Acting Assignments' })
    @RequirePermissions('view_payroll_settings')
    async findAll(@Req() req: any) {
        return this.actingService.findAll(req.user.tenantSlug);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete Acting Assignment' })
    @RequirePermissions('edit_payroll_settings')
    async remove(@Req() req: any, @Param('id') id: string) {
        return this.actingService.remove(req.user.tenantSlug, id);
    }
}
