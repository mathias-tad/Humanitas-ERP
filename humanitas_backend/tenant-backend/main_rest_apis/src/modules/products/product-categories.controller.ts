import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { CreateProductCategoryDto, UpdateProductCategoryDto } from './dto/products.dto';
import { PRODUCT_CATEGORY_PERMISSIONS as P } from './products.permissions';
import { ProductCategoriesService } from './product-categories.service';
import { catalogContext } from './products.context';

@Controller('product-categories')
@RequireModule('products')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class ProductCategoriesController {
  constructor(private readonly categories: ProductCategoriesService) {}

  @Get()
  @RequirePermissions(P.view)
  list(@Request() req: AuthenticatedRequest, @Query('include_archived') includeArchived?: string) {
    return this.categories.list(catalogContext(req), includeArchived === 'true');
  }

  @Get(':id')
  @RequirePermissions(P.view)
  get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.categories.get(catalogContext(req), id);
  }

  @Post()
  @RequirePermissions(P.create)
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateProductCategoryDto) {
    return this.categories.create(catalogContext(req), dto);
  }

  @Patch(':id')
  @RequirePermissions(P.edit)
  update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductCategoryDto) {
    return this.categories.update(catalogContext(req), id, dto);
  }

  @Delete(':id')
  @RequirePermissions(P.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.categories.archive(catalogContext(req), id);
  }
}
