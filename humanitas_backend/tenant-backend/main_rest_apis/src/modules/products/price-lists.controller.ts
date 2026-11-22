import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { PRICE_LIST_PERMISSIONS as P } from './products.permissions';
import { PriceListsService } from './price-lists.service';
import { catalogContext } from './products.context';
import {
  BulkPriceRulesDto, CompareQueryDto, CreatePriceListDto, ListPriceListsQueryDto, PriceQueryDto, PriceRuleDto, UpdatePriceListDto, UpdatePriceRuleDto,
} from './dto/price-lists.dto';

/** Price lists (Retail, Wholesale, VIP…) and line prices for Sales, POS and the online store. */
@Controller('price-lists')
@RequireModule('products')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class PriceListsController {
  constructor(private readonly lists: PriceListsService) {}

  @Get()
  @RequirePermissions(P.view)
  list(@Request() req: AuthenticatedRequest, @Query() q: ListPriceListsQueryDto) {
    return this.lists.list(catalogContext(req), q.include_archived === 'true');
  }

  /** Line price: GET /price-lists/price?product_id=…&quantity=12 (default list when price_list_id is omitted). */
  @Get('price')
  @RequirePermissions(P.view)
  price(@Request() req: AuthenticatedRequest, @Query() q: PriceQueryDto) {
    return this.lists.price(catalogContext(req), q);
  }

  /** Price list comparison report. */
  @Get('compare')
  @RequirePermissions(P.view)
  compare(@Request() req: AuthenticatedRequest, @Query() q: CompareQueryDto) {
    return this.lists.compare(catalogContext(req), q);
  }

  @Get('compare.csv')
  @RequirePermissions(P.export)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="price-lists.csv"')
  compareCsv(@Request() req: AuthenticatedRequest, @Query() q: CompareQueryDto) {
    return this.lists.compareCsv(catalogContext(req), q);
  }

  @Get('default')
  @RequirePermissions(P.view)
  getDefault(@Request() req: AuthenticatedRequest) {
    return this.lists.getDefault(catalogContext(req));
  }

  /** A product's price on every list (a product with variants: each variant). */
  @Get('for-product/:productId')
  @RequirePermissions(P.view)
  forProduct(@Request() req: AuthenticatedRequest, @Param('productId', ParseUUIDPipe) productId: string, @Query('quantity') quantity?: string) {
    const qty = Number(quantity);
    return this.lists.pricesForProduct(catalogContext(req), productId, Number.isFinite(qty) && qty >= 0 ? qty : 1);
  }

  @Get(':id')
  @RequirePermissions(P.view)
  get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Query('include_archived') includeArchived?: string) {
    return this.lists.get(catalogContext(req), id, includeArchived === 'true');
  }

  @Post()
  @RequirePermissions(P.create)
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreatePriceListDto) {
    return this.lists.create(catalogContext(req), dto);
  }

  @Patch(':id')
  @RequirePermissions(P.edit)
  update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePriceListDto) {
    return this.lists.update(catalogContext(req), id, dto);
  }

  /** Archives the list (rule 24); restore with PATCH is_active: true. The default list cannot be archived. */
  @Delete(':id')
  @RequirePermissions(P.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.lists.archive(catalogContext(req), id);
  }

  @Post(':id/rules')
  @RequirePermissions(P.edit)
  addRule(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PriceRuleDto) {
    return this.lists.addRule(catalogContext(req), id, dto);
  }

  /** The same rule for several products at once (one rule per product). */
  @Post(':id/rules/bulk')
  @RequirePermissions(P.edit)
  addRules(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BulkPriceRulesDto) {
    return this.lists.addRules(catalogContext(req), id, dto);
  }

  @Patch(':id/rules/:ruleId')
  @RequirePermissions(P.edit)
  updateRule(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdatePriceRuleDto,
  ) {
    return this.lists.updateRule(catalogContext(req), id, ruleId, dto);
  }

  @Delete(':id/rules/:ruleId')
  @RequirePermissions(P.edit)
  archiveRule(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Param('ruleId', ParseUUIDPipe) ruleId: string) {
    return this.lists.archiveRule(catalogContext(req), id, ruleId);
  }
}
