import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { CreateUomCategoryDto, CreateUomDto, UpdateUomDto } from './dto/products.dto';
import { UOM_PERMISSIONS as P } from './products.permissions';
import { UomsService } from './uoms.service';
import { catalogContext } from './products.context';

@Controller('uoms')
@RequireModule('products')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class UomsController {
  constructor(private readonly uoms: UomsService) {}

  @Get()
  @RequirePermissions(P.view)
  list(@Request() req: AuthenticatedRequest, @Query('include_inactive') includeInactive?: string) {
    return this.uoms.list(catalogContext(req), includeInactive === 'true');
  }

  @Post('categories')
  @RequirePermissions(P.create)
  createCategory(@Request() req: AuthenticatedRequest, @Body() dto: CreateUomCategoryDto) {
    return this.uoms.createCategory(catalogContext(req), dto);
  }

  @Post()
  @RequirePermissions(P.create)
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateUomDto) {
    return this.uoms.create(catalogContext(req), dto);
  }

  @Patch(':id')
  @RequirePermissions(P.edit)
  update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUomDto) {
    return this.uoms.update(catalogContext(req), id, dto);
  }

  @Delete(':id')
  @RequirePermissions(P.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.uoms.archive(catalogContext(req), id);
  }
}
