import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { catalogContext } from '../../common/records/record-context';
import {
  LOCATION_PERMISSIONS as L,
  STOCK_PERMISSIONS as S,
  TRANSFER_PERMISSIONS as T,
  WAREHOUSE_PERMISSIONS as W,
} from './inventory.permissions';
import { WarehousesService } from './warehouses.service';
import { StockService } from './stock.service';
import { TransfersService } from './transfers.service';
import {
  AdjustStockDto, CreateLocationDto, CreateTransferDto, CreateWarehouseDto, ListLocationsQueryDto,
  ListStockQueryDto, ListTransfersQueryDto, ListWarehousesQueryDto, AddMoveDto, UpdateLocationDto,
  UpdateTransferDto, UpdateWarehouseDto,
} from './dto/inventory.dto';

/** Cost and value columns, shown only with view_stock_valuation (a picker need not see money). */
const MONEY = ['unit_cost', 'stock_value', 'total_cost', 'cost_price', 'value'] as const;

function seesMoney(req: AuthenticatedRequest): boolean {
  const u = req.user;
  if (!u) return false;
  if (u.role === 'owner' || u.role === 'admin') return true;
  const perms = u.permissions ?? [];
  return perms.includes('*') || perms.includes(S.viewValuation);
}

/** Drops the money columns from rows (or { data, moves } shapes) for people without the valuation permission. */
export function hideMoney<T>(req: AuthenticatedRequest, result: T): T {
  if (seesMoney(req)) return result;
  const strip = (row: unknown) => {
    if (!row || typeof row !== 'object') return row;
    const out = { ...(row as Record<string, unknown>) };
    for (const k of MONEY) delete out[k];
    if (Array.isArray(out.moves)) out.moves = out.moves.map(strip);
    return out;
  };
  if (Array.isArray(result)) return result.map(strip) as T;
  if (result && typeof result === 'object') {
    const r = { ...(result as Record<string, unknown>) };
    if (Array.isArray(r.data)) r.data = r.data.map(strip);
    if (Array.isArray(r.moves)) r.moves = r.moves.map(strip);
    if (r.totals && typeof r.totals === 'object') {
      const t = { ...(r.totals as Record<string, unknown>) };
      delete t.value;
      r.totals = t;
    }
    return r as T;
  }
  return result;
}

/**
 * Inventory & Warehouse (featureslist §2). Every endpoint is gated by the subscription
 * (ModuleSubscriptionGuard) and exactly one granular permission (rules 4, 27); the
 * company/branch scope is read from the x-company-id / x-branch-id headers the switcher sets.
 */
@Controller('inventory/warehouses')
@RequireModule('inventory')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class InventoryWarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  @RequirePermissions(W.view)
  list(@Request() req: AuthenticatedRequest, @Query() q: ListWarehousesQueryDto) {
    return this.warehouses.list(catalogContext(req), q);
  }

  @Get(':id')
  @RequirePermissions(W.view)
  get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.warehouses.get(catalogContext(req), id);
  }

  @Post()
  @RequirePermissions(W.create)
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(catalogContext(req), dto);
  }

  @Patch(':id')
  @RequirePermissions(W.edit)
  update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehouses.update(catalogContext(req), id, dto);
  }

  /** Archives the warehouse (soft delete, rule 24); stock on hand blocks it. */
  @Delete(':id')
  @RequirePermissions(W.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.warehouses.archive(catalogContext(req), id);
  }

  @Post(':id/restore')
  @RequirePermissions(W.edit)
  restore(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.warehouses.restore(catalogContext(req), id);
  }
}

/** Storage locations: the Warehouse → Zone → Aisle → Bin tree (featureslist §2). */
@Controller('inventory/locations')
@RequireModule('inventory')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class InventoryLocationsController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  @RequirePermissions(L.view)
  list(@Request() req: AuthenticatedRequest, @Query() q: ListLocationsQueryDto) {
    return this.warehouses.listLocations(catalogContext(req), q);
  }

  @Get('tree')
  @RequirePermissions(L.view)
  tree(@Request() req: AuthenticatedRequest, @Query() q: ListLocationsQueryDto) {
    return this.warehouses.locationTree(catalogContext(req), q.warehouse_id);
  }

  @Get(':id')
  @RequirePermissions(L.view)
  get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.warehouses.getLocation(catalogContext(req), id);
  }

  @Post()
  @RequirePermissions(L.create)
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateLocationDto) {
    return this.warehouses.createLocation(catalogContext(req), dto);
  }

  @Patch(':id')
  @RequirePermissions(L.edit)
  update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLocationDto) {
    return this.warehouses.updateLocation(catalogContext(req), id, dto);
  }

  /** Archives a location; stock held there or active children block it. */
  @Delete(':id')
  @RequirePermissions(L.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.warehouses.archiveLocation(catalogContext(req), id);
  }
}

/** Stock on hand, the manual adjustment, movement history and the stock CSV. */
@Controller('inventory/stock')
@RequireModule('inventory')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class InventoryStockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  @RequirePermissions(S.view)
  async list(@Request() req: AuthenticatedRequest, @Query() q: ListStockQueryDto) {
    return hideMoney(req, await this.stock.list(catalogContext(req), q));
  }

  /** Totals per product, including value (money figures need the valuation permission). */
  @Get('summary')
  @RequirePermissions(S.viewValuation)
  summary(@Request() req: AuthenticatedRequest, @Query() q: ListStockQueryDto) {
    return this.stock.summary(catalogContext(req), q);
  }

  /** One product's stock by warehouse and location, with its configuration. */
  @Get('product/:id')
  @RequirePermissions(S.view)
  async forProduct(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return hideMoney(req, await this.stock.forProduct(catalogContext(req), id));
  }

  /** A manual +in / -out adjustment with a recorded reason (audited on the timeline). */
  @Post('adjust')
  @RequirePermissions(S.adjust)
  async adjust(@Request() req: AuthenticatedRequest, @Body() dto: AdjustStockDto) {
    return hideMoney(req, await this.stock.adjust(catalogContext(req), dto));
  }

  /** Movement history from the append-only ledger. */
  @Get('movements')
  @RequirePermissions(S.view)
  async movements(
    @Request() req: AuthenticatedRequest,
    @Query('product_id') productId?: string,
    @Query('warehouse_id') warehouseId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return hideMoney(req, await this.stock.movements(catalogContext(req), {
      product_id: productId, warehouse_id: warehouseId, from, to,
      limit: limit ? Number(limit) : undefined, page: page ? Number(page) : undefined,
    }));
  }

  @Get('export.csv')
  @RequirePermissions(S.export)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="stock.csv"')
  exportCsv(@Request() req: AuthenticatedRequest, @Query() q: ListStockQueryDto) {
    return this.stock.exportCsv(catalogContext(req), q, seesMoney(req));
  }
}

/** Transfers: receipts, deliveries, internal moves and returns (featureslist §2). */
@Controller('inventory/transfers')
@RequireModule('inventory')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class InventoryTransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  @RequirePermissions(T.view)
  list(@Request() req: AuthenticatedRequest, @Query() q: ListTransfersQueryDto) {
    return this.transfers.list(catalogContext(req), q);
  }

  @Get('export.csv')
  @RequirePermissions(T.export)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="transfers.csv"')
  exportCsv(@Request() req: AuthenticatedRequest, @Query() q: ListTransfersQueryDto) {
    return this.transfers.exportCsv(catalogContext(req), q);
  }

  @Get(':id')
  @RequirePermissions(T.view)
  async get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return hideMoney(req, await this.transfers.get(catalogContext(req), id));
  }

  @Post()
  @RequirePermissions(T.create)
  async create(@Request() req: AuthenticatedRequest, @Body() dto: CreateTransferDto) {
    return hideMoney(req, await this.transfers.create(catalogContext(req), dto));
  }

  @Patch(':id')
  @RequirePermissions(T.edit)
  async update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTransferDto) {
    return hideMoney(req, await this.transfers.update(catalogContext(req), id, dto));
  }

  // Move lines, editable while the transfer is not done.
  @Post(':id/moves')
  @RequirePermissions(T.edit)
  async addMove(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddMoveDto) {
    return hideMoney(req, await this.transfers.addMove(catalogContext(req), id, dto));
  }

  @Patch(':id/moves/:moveId')
  @RequirePermissions(T.edit)
  async updateMove(
    @Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string,
    @Param('moveId', ParseUUIDPipe) moveId: string, @Body() dto: AddMoveDto,
  ) {
    return hideMoney(req, await this.transfers.updateMove(catalogContext(req), id, moveId, dto));
  }

  @Delete(':id/moves/:moveId')
  @RequirePermissions(T.edit)
  async cancelMove(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Param('moveId', ParseUUIDPipe) moveId: string) {
    return hideMoney(req, await this.transfers.cancelMove(catalogContext(req), id, moveId));
  }

  @Post(':id/start')
  @RequirePermissions(T.edit)
  async start(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return hideMoney(req, await this.transfers.start(catalogContext(req), id));
  }

  /** Mark done: applies the moves atomically and triggers the valuation engine. */
  @Post(':id/validate')
  @RequirePermissions(T.validate)
  async validate(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return hideMoney(req, await this.transfers.validate(catalogContext(req), id));
  }

  @Post(':id/cancel')
  @RequirePermissions(T.cancel)
  async cancel(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return hideMoney(req, await this.transfers.cancel(catalogContext(req), id));
  }

  /** Deletes a not-yet-posted transfer (draft/cancelled); the ledger keeps every done one. */
  @Delete(':id')
  @RequirePermissions(T.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.transfers.delete(catalogContext(req), id);
  }
}
