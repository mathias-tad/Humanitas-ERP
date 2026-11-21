import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { catalog } from './module-catalog';

@ApiTags('Modules')
@Controller('modules')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class ModuleCatalogController {
  @Get('catalog')
  @ApiOperation({ summary: 'Module catalog: modules, dependencies and auto-activated bridges' })
  getCatalog() {
    return catalog();
  }
}
