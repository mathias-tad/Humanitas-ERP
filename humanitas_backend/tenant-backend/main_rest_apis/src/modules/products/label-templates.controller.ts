import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { LABEL_TEMPLATE_PERMISSIONS as P } from './products.permissions';
import { LabelTemplatesService } from './label-templates.service';
import { catalogContext } from './products.context';
import { CreateLabelTemplateDto, LabelPricesDto, ListLabelTemplatesQueryDto, UpdateLabelTemplateDto } from './dto/label-templates.dto';

/** Barcode, QR and price label templates; printing happens in the browser (Products -> Labels). */
@Controller('label-templates')
@RequireModule('products')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class LabelTemplatesController {
  constructor(private readonly templates: LabelTemplatesService) {}

  @Get()
  @RequirePermissions(P.view)
  list(@Request() req: AuthenticatedRequest, @Query() q: ListLabelTemplatesQueryDto) {
    return this.templates.list(catalogContext(req), q.include_archived === 'true');
  }

  /** Prices for the labels being printed: POST { product_ids, price_list_id? }. */
  @Post('prices')
  @RequirePermissions(P.view)
  prices(@Request() req: AuthenticatedRequest, @Body() dto: LabelPricesDto) {
    return this.templates.prices(catalogContext(req), dto);
  }

  @Get(':id')
  @RequirePermissions(P.view)
  get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.templates.get(catalogContext(req), id);
  }

  @Post()
  @RequirePermissions(P.create)
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateLabelTemplateDto) {
    return this.templates.create(catalogContext(req), dto);
  }

  @Patch(':id')
  @RequirePermissions(P.edit)
  update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLabelTemplateDto) {
    return this.templates.update(catalogContext(req), id, dto);
  }

  /** Archives the template (rule 24); restore with PATCH is_active: true. */
  @Delete(':id')
  @RequirePermissions(P.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.templates.archive(catalogContext(req), id);
  }
}
