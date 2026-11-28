import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { catalogContext } from '../../common/records/record-context';
import { STOCK_PERMISSIONS, STOCKTAKE_PERMISSIONS as C } from './inventory.permissions';
import { StocktakesService } from './stocktakes.service';
import { CountLineDto, CountScanDto, CreateStocktakeDto, UpdateCountLineDto } from './stocktakes.dto';

const has = (req: AuthenticatedRequest, permission: string) => {
  const u = req.user;
  if (!u) return false;
  if (u.role === 'owner' || u.role === 'admin') return true;
  const perms = u.permissions ?? [];
  return perms.includes('*') || perms.includes(permission);
};

/** Whoever approves a count may see what was expected, also on a blind count. */
const reveals = (req: AuthenticatedRequest) => has(req, C.approve);

const MONEY = ['unit_cost', 'variance_value', 'variance_value_gain', 'variance_value_loss'] as const;

/** Drops cost and value figures for people without view_stock_valuation. */
export function hideCountMoney<T>(req: AuthenticatedRequest, result: T): T {
  if (has(req, STOCK_PERMISSIONS.viewValuation)) return result;
  const strip = (row: unknown) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
    const out = { ...(row as Record<string, unknown>) };
    for (const k of MONEY) delete out[k];
    if (out.totals && typeof out.totals === 'object') out.totals = strip(out.totals);
    if (out.line && typeof out.line === 'object') out.line = strip(out.line);
    if (Array.isArray(out.data)) out.data = out.data.map(strip);
    return out;
  };
  return strip(result) as T;
}

/**
 * Stocktakes (featureslist §2): plan, count by scanning, review and post the differences.
 * Each step has its own permission (rule 27); posting is the step that changes stock. The service
 * checks every count against the company/branch scope (a count of another branch is not found).
 */
@Controller('inventory/counts')
@RequireModule('inventory')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class InventoryStocktakesController {
  constructor(private readonly counts: StocktakesService) {}

  @Get()
  @RequirePermissions(C.view)
  list(
    @Request() req: AuthenticatedRequest,
    @Query('state') state?: string,
    @Query('warehouse_id') warehouseId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.counts.list(catalogContext(req), {
      state, warehouse_id: warehouseId, search, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions(C.view)
  async get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return hideCountMoney(req, await this.counts.get(catalogContext(req), id, { revealExpected: reveals(req) }));
  }

  /** ?filter=uncounted|counted|variance|unexpected&location_id=&search= */
  @Get(':id/lines')
  @RequirePermissions(C.view)
  async lines(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('filter') filter?: string,
    @Query('location_id') locationId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return hideCountMoney(req, await this.counts.lines(catalogContext(req), id, {
      filter, location_id: locationId, search, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined,
    }, { revealExpected: reveals(req) }));
  }

  @Get(':id/sheet.csv')
  @RequirePermissions(C.export)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="stocktake.csv"')
  sheet(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.counts.sheetCsv(catalogContext(req), id, { revealExpected: reveals(req), showMoney: has(req, STOCK_PERMISSIONS.viewValuation) });
  }

  @Post()
  @RequirePermissions(C.create)
  async create(@Request() req: AuthenticatedRequest, @Body() dto: CreateStocktakeDto) {
    return hideCountMoney(req, await this.counts.create(catalogContext(req), dto));
  }

  /** Freezes the expected quantities and opens counting. */
  @Post(':id/start')
  @RequirePermissions(C.create)
  async start(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return hideCountMoney(req, await this.counts.start(catalogContext(req), id));
  }

  @Post(':id/lines')
  @RequirePermissions(C.count)
  async setLine(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CountLineDto) {
    return hideCountMoney(req, await this.counts.setLine(catalogContext(req), id, dto));
  }

  @Patch(':id/lines/:lineId')
  @RequirePermissions(C.count)
  async updateLine(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: UpdateCountLineDto,
  ) {
    return hideCountMoney(req, await this.counts.updateLine(catalogContext(req), id, lineId, dto));
  }

  /** A scanned location, product barcode, SKU or lot/serial number. */
  @Post(':id/scan')
  @RequirePermissions(C.count)
  async scan(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CountScanDto) {
    return hideCountMoney(req, await this.counts.scan(catalogContext(req), id, dto));
  }

  @Post(':id/submit')
  @RequirePermissions(C.count)
  async submit(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return hideCountMoney(req, await this.counts.submit(catalogContext(req), id));
  }

  /** Approve and post: the differences become stock adjustments. */
  @Post(':id/post')
  @RequirePermissions(C.approve)
  async post(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return hideCountMoney(req, await this.counts.post(catalogContext(req), id));
  }

  @Post(':id/cancel')
  @RequirePermissions(C.cancel)
  async cancel(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return hideCountMoney(req, await this.counts.cancel(catalogContext(req), id));
  }
}
