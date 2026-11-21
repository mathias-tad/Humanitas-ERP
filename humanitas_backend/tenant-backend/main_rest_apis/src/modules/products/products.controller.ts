import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { CreateProductDto, ListProductsQueryDto, UpdateProductDto } from './dto/products.dto';
import { PRODUCT_PERMISSIONS as P } from './products.permissions';
import { ProductsService } from './products.service';
import { catalogContext } from './products.context';

@Controller('products')
@RequireModule('products')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions(P.view)
  list(@Request() req: AuthenticatedRequest, @Query() query: ListProductsQueryDto) {
    return this.products.list(catalogContext(req), query);
  }

  /** Scanner lookup by barcode or SKU: GET /products/lookup?code=6290000000017 */
  @Get('lookup')
  @RequirePermissions(P.view)
  lookup(@Request() req: AuthenticatedRequest, @Query('code') code: string) {
    return this.products.lookup(catalogContext(req), code);
  }

  @Get('export.csv')
  @RequirePermissions(P.export)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="products.csv"')
  exportCsv(@Request() req: AuthenticatedRequest, @Query() query: ListProductsQueryDto) {
    return this.products.exportCsv(catalogContext(req), query);
  }

  @Get(':id')
  @RequirePermissions(P.view)
  get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.products.get(catalogContext(req), id);
  }

  @Get(':id/timeline')
  @RequirePermissions(P.view)
  timeline(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.products.timelineFor(catalogContext(req), id, { limit: limit ? Number(limit) : undefined, before });
  }

  /** Also the quick-create endpoint (featureslist §29): only `name` is required. */
  @Post()
  @RequirePermissions(P.create)
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateProductDto) {
    return this.products.create(catalogContext(req), dto);
  }

  @Patch(':id')
  @RequirePermissions(P.edit)
  update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(catalogContext(req), id, dto);
  }

  /** Archives the product (rule 24); restore with POST /products/:id/restore. */
  @Delete(':id')
  @RequirePermissions(P.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.products.archive(catalogContext(req), id);
  }

  @Post(':id/restore')
  @RequirePermissions(P.restore)
  restore(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.products.restore(catalogContext(req), id);
  }
}
