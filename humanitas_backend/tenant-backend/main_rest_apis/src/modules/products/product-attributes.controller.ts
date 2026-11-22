import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { PRODUCT_ATTRIBUTE_PERMISSIONS as P } from './products.permissions';
import { ProductAttributesService } from './product-attributes.service';
import { catalogContext } from './products.context';
import { AttributeValueDto, CreateAttributeDto, UpdateAttributeDto, UpdateAttributeValueDto } from './dto/product-variants.dto';

/** Product attributes (Size, Color…) and their values, used to generate variants (featureslist §1). */
@Controller('product-attributes')
@RequireModule('products')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class ProductAttributesController {
  constructor(private readonly attributes: ProductAttributesService) {}

  @Get()
  @RequirePermissions(P.view)
  list(@Request() req: AuthenticatedRequest, @Query('include_archived') includeArchived?: string) {
    return this.attributes.list(catalogContext(req), includeArchived === 'true');
  }

  @Get(':id')
  @RequirePermissions(P.view)
  get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.attributes.get(catalogContext(req), id);
  }

  @Post()
  @RequirePermissions(P.create)
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateAttributeDto) {
    return this.attributes.create(catalogContext(req), dto);
  }

  @Patch(':id')
  @RequirePermissions(P.edit)
  update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAttributeDto) {
    return this.attributes.update(catalogContext(req), id, dto);
  }

  /** Archives the attribute (rule 24); refused while products use it. */
  @Delete(':id')
  @RequirePermissions(P.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.attributes.archive(catalogContext(req), id);
  }

  /** Adds a value on the fly (from the Attributes page or a product's Variants tab). */
  @Post(':id/values')
  @RequirePermissions(P.edit)
  addValue(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AttributeValueDto) {
    return this.attributes.addValue(catalogContext(req), id, dto);
  }

  @Patch(':id/values/:valueId')
  @RequirePermissions(P.edit)
  updateValue(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('valueId', ParseUUIDPipe) valueId: string,
    @Body() dto: UpdateAttributeValueDto,
  ) {
    return this.attributes.updateValue(catalogContext(req), id, valueId, dto);
  }

  /** Archives a value; refused while active variants use it. */
  @Delete(':id/values/:valueId')
  @RequirePermissions(P.delete)
  archiveValue(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('valueId', ParseUUIDPipe) valueId: string,
  ) {
    return this.attributes.archiveValue(catalogContext(req), id, valueId);
  }
}
