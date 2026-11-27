import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from '../../common/records/record-context';
import { csvCell } from '../../common/records/csv';
import { InventoryBase, ENTITY, blankToNull, type LedgerMove } from './inventory.base';
import type { Queryable } from '../../common/records/record-scope';
import { ValuationClient } from './valuation-client';
import type {
  AddMoveDto, CreateTransferDto, ListTransfersQueryDto, TRANSFER_STATES, UpdateTransferDto,
} from './dto/inventory.dto';
import type { CreateMoveDto } from './dto/inventory.dto';

const STATE_FLOW: Record<string, typeof TRANSFER_STATES[number][]> = {
  draft: ['in_progress', 'cancelled'],
  waiting: ['in_progress', 'cancelled'],
  ready: ['in_progress', 'cancelled'],
  in_progress: ['done', 'cancelled'],
  done: [],
  cancelled: [],
};

/**
 * Which sides of a move a transfer fills in from its warehouses when the line leaves them open
 * (one-step routes, Odoo's default): receipts and customer returns land in the destination
 * warehouse's stock location, deliveries and vendor returns leave from the source warehouse's,
 * internal transfers go from one warehouse's stock to the other's. The outside party (vendor,
 * customer) is no location: an inbound move has no source, an outbound one no destination.
 */
const SIDES: Record<string, ('from' | 'to')[]> = {
  receipt: ['to'],
  return_in: ['to'],
  delivery: ['from'],
  return_out: ['from'],
  internal: ['from', 'to'],
};

const COLUMNS = ['origin', 'partner_contact_id', 'partner_name', 'from_warehouse_id', 'to_warehouse_id',
  'scheduled_date', 'responsible_user_id', 'reason', 'notes'] as const;

/** The columns the service reads back from inventory_transfers, with loose but safe types. */
export interface TransferRow {
  id: string;
  name: string;
  transfer_type: string;
  state: string;
  from_warehouse_id: string | null;
  to_warehouse_id: string | null;
  company_id: string | null;
  branch_id: string | null;
  [k: string]: unknown;
}

/**
 * Transfers: receipts, deliveries, internal moves and returns (featureslist §2).
 *
 * A transfer is a document with move lines. Nothing moves until someone marks it done, and then
 * every move is applied to the quants in one `conn.transaction` and recorded in the append-only
 * ledger — a done transfer is never edited, it is cancelled or reversed. Stock moves atomically;
 * the valuation layers follow, computed by the Python engine (rule 8) and triggered afterwards.
 *
 * Multi-company/branch (rule 16): the transfer, its warehouses and every product/lot on its moves
 * must be visible in the scope; a branch-limited user can only move their own branch's stock.
 */
@Injectable()
export class TransfersService extends InventoryBase {
  constructor(
    protected readonly databaseService: DatabaseService,
    protected readonly timeline: ActivityTimelineService,
    private readonly valuation: ValuationClient,
  ) {
    super();
  }

  async list(ctx: CatalogContext, q: ListTransfersQueryDto) {
    const { conn, scope } = await this.open(ctx);
    const params: unknown[] = [
      q.transfer_type ?? null, q.state ?? null, q.warehouse_id ?? null, q.product_id ?? null,
      q.search ? `%${q.search}%` : null, q.from ?? null, q.to ?? null,
    ];
    const where = [
      '($1::text IS NULL OR t.transfer_type = $1)',
      '($2::text IS NULL OR t.state = $2)',
      '($3::uuid IS NULL OR t.from_warehouse_id = $3 OR t.to_warehouse_id = $3)',
      `($4::uuid IS NULL OR EXISTS (SELECT 1 FROM inventory_moves m WHERE m.transfer_id = t.id AND m.product_id = $4))`,
      '($5::text IS NULL OR t.name ILIKE $5 OR t.partner_name ILIKE $5 OR t.origin ILIKE $5)',
      '($6::date IS NULL OR t.scheduled_date >= $6)',
      '($7::date IS NULL OR t.scheduled_date <= $7)',
    ];
    const f = this.scopeFilter(scope, 't', params);
    if (f) { params.push(...f.param); where.push(f.sql); }
    const limit = Math.min(q.limit ?? 50, 200);
    const page = q.page ?? 1;
    const w = `WHERE ${where.join(' AND ')}`;
    const [{ total }] = await conn.query(`SELECT count(*)::int AS total FROM inventory_transfers t ${w}`, params);
    const data = await conn.query(
      `SELECT t.*, (SELECT count(*)::int FROM inventory_moves m WHERE m.transfer_id = t.id AND m.state <> 'cancelled') AS move_count
         FROM inventory_transfers t ${w}
        ORDER BY t.created_at DESC, t.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    const [counts] = await conn.query(
      `SELECT count(*) FILTER (WHERE state = 'draft' OR state = 'waiting' OR state = 'ready')::int AS open,
             count(*) FILTER (WHERE state = 'in_progress')::int AS in_progress,
             count(*) FILTER (WHERE state = 'done')::int AS done,
             count(*) FILTER (WHERE state = 'cancelled')::int AS cancelled
        FROM inventory_transfers t ${w}`,
      params,
    );
    return { data, meta: { page, limit, total }, counts };
  }

  async get(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const t = await this.findVisible<TransferRow>(conn, scope, 'inventory_transfers', id, 'transfer');
    const moves = await conn.query(
      `SELECT m.*, p.name AS product_name, p.sku, l.name AS lot_name,
              fl.code AS from_location_code, tl.code AS to_location_code
         FROM inventory_moves m
         JOIN products p ON p.id = m.product_id
         LEFT JOIN inventory_lots l ON l.id = m.lot_id
         LEFT JOIN inventory_locations fl ON fl.id = m.from_location_id
         LEFT JOIN inventory_locations tl ON tl.id = m.to_location_id
        WHERE m.transfer_id = $1 AND m.state <> 'cancelled' ORDER BY m.created_at, m.id`,
      [id],
    );
    return { ...t, moves };
  }

  async create(ctx: CatalogContext, dto: CreateTransferDto) {
    const { conn, scope } = await this.open(ctx);
    if (dto.from_warehouse_id) await this.findVisible(conn, scope, 'inventory_warehouses', dto.from_warehouse_id, 'warehouse');
    if (dto.to_warehouse_id) await this.findVisible(conn, scope, 'inventory_warehouses', dto.to_warehouse_id, 'warehouse');
    if (!dto.from_warehouse_id && !dto.to_warehouse_id) {
      throw new BadRequestException('A transfer needs at least a source or a destination warehouse');
    }
    if (dto.responsible_user_id) await this.checkUser(conn, dto.responsible_user_id);
    const place = this.placement(scope, dto.company_id, dto.branch_id);
    // Every product (rule 20) and lot on the transfer's moves must be visible in the scope.
    for (const m of dto.moves ?? []) await this.checkLine(conn, scope, m);
    const moves = (dto.moves ?? []).map((m) => this.cleanMove(m));

    const { id: createdId, name: documentName } = await conn.transaction(async (m: Queryable) => {
      const name = await this.nextNumber(m, this.kindOf(dto.transfer_type), place.company_id);
      const [t] = await m.query(
        `INSERT INTO inventory_transfers
           (name, transfer_type, origin, partner_contact_id, partner_name, from_warehouse_id, to_warehouse_id,
            scheduled_date, responsible_user_id, reason, notes, company_id, branch_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
         RETURNING id`,
        [
          name, dto.transfer_type, blankToNull(dto.origin), dto.partner_contact_id ?? null, blankToNull(dto.partner_name),
          dto.from_warehouse_id ?? null, dto.to_warehouse_id ?? null, dto.scheduled_date ?? null,
          dto.responsible_user_id ?? null, blankToNull(dto.reason), blankToNull(dto.notes),
          place.company_id, place.branch_id ?? null, ctx.user?.sub ?? null,
        ],
      );
      for (const mv of moves) await this.insertMove(m, t.id as string, dto.transfer_type, mv, place, ctx.user?.sub);
      return { id: t.id as string, name };
    });
    await this.record(ctx, ENTITY.transfer, createdId, 'created', `Transfer ${documentName} created (${dto.transfer_type})`, { moves: moves.length });
    return this.get(ctx, createdId);
  }

  async update(ctx: CatalogContext, id: string, dto: UpdateTransferDto) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findVisible<TransferRow>(conn, scope, 'inventory_transfers', id, 'transfer');
    if (['done', 'cancelled'].includes(String(before.state))) {
      throw new BadRequestException('A finished transfer cannot be edited; cancel it and start a new one');
    }
    if (dto.from_warehouse_id) await this.findVisible(conn, scope, 'inventory_warehouses', dto.from_warehouse_id, 'warehouse');
    if (dto.to_warehouse_id) await this.findVisible(conn, scope, 'inventory_warehouses', dto.to_warehouse_id, 'warehouse');
    if (dto.responsible_user_id) await this.checkUser(conn, dto.responsible_user_id);
    const row = this.clean(dto);
    const cols = COLUMNS.filter((c) => row[c] !== undefined);
    if (!cols.length) return before;
    await conn.query(
      `UPDATE inventory_transfers SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')},
              updated_by = $${cols.length + 1}, updated_at = now() WHERE id = $${cols.length + 2}`,
      [...cols.map((c) => row[c]), ctx.user?.sub ?? null, id],
    );
    const after = await this.findVisible<TransferRow>(conn, scope, 'inventory_transfers', id, 'transfer');
    await this.timeline.recordChanges(ctx.tenantId, {
      entityType: ENTITY.transfer, entityId: id, moduleKey: 'inventory', before, after,
      fields: { origin: 'Origin', partner_name: 'Partner', from_warehouse_id: 'From warehouse', to_warehouse_id: 'To warehouse',
        scheduled_date: 'Scheduled', responsible_user_id: 'Responsible', reason: 'Reason', notes: 'Notes' },
      actorId: ctx.user?.sub, client: ctx.client,
    });
    return after;
  }

  // ── Move lines (while the transfer is not done) ────────────────────────────────

  /** A move line, shaped for the ledger; product/lot visibility is asserted by the caller. */
  private cleanMove(m: CreateMoveDto): Record<string, unknown> {
    if (!m.quantity || m.quantity <= 0) throw new BadRequestException('A move must carry a quantity greater than zero');
    return {
      product_id: m.product_id,
      quantity: m.quantity,
      lot_id: m.lot_id ?? null,
      from_location_id: m.from_location_id ?? null,
      to_location_id: m.to_location_id ?? null,
      uom_id: m.uom_id ?? null,
      unit_cost: m.unit_cost ?? null,
      move_type: m.move_type ?? null,
    };
  }

  async addMove(ctx: CatalogContext, transferId: string, dto: AddMoveDto) {
    const { conn, scope } = await this.open(ctx);
    const t = await this.editable(ctx, conn, scope, transferId);
    await this.checkLine(conn, scope, dto);
    const place = { company_id: (t.company_id as string | null) ?? null, branch_id: t.branch_id as string | null };
    let move;
    await conn.transaction(async (m: Queryable) => {
      move = await this.insertMove(m, t.id, t.transfer_type as string, this.cleanMove(dto), place, ctx.user?.sub);
    });
    await this.record(ctx, ENTITY.transfer, t.id, 'updated', `Move added to transfer ${t.name}`);
    return move;
  }

  async updateMove(ctx: CatalogContext, transferId: string, moveId: string, dto: AddMoveDto) {
    const { conn, scope } = await this.open(ctx);
    await this.editable(ctx, conn, scope, transferId);
    const [move] = await conn.query(`SELECT * FROM inventory_moves WHERE id = $1 AND transfer_id = $2`, [moveId, transferId]);
    if (!move) throw new BadRequestException('That move is not part of this transfer');
    if (move.state !== 'draft') throw new BadRequestException('Only draft moves can be changed; the rest is in the ledger');
    await this.checkLine(conn, scope, dto);
    const row = this.cleanMove(dto);
    const cols = ['product_id', 'lot_id', 'from_location_id', 'to_location_id', 'quantity', 'uom_id', 'unit_cost', 'move_type'].filter((c) => row[c] !== undefined);
    await conn.query(
      `UPDATE inventory_moves SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = now() WHERE id = $${cols.length + 1}`,
      [...cols.map((c) => row[c]), moveId],
    );
    return this.get(ctx, transferId);
  }

  /** Cancels a draft move line (the ledger keeps it, flagged cancelled). */
  async cancelMove(ctx: CatalogContext, transferId: string, moveId: string) {
    const { conn, scope } = await this.open(ctx);
    await this.editable(ctx, conn, scope, transferId);
    const [move] = await conn.query(`SELECT * FROM inventory_moves WHERE id = $1 AND transfer_id = $2`, [moveId, transferId]);
    if (!move) throw new BadRequestException('That move is not part of this transfer');
    if (move.state !== 'draft') throw new BadRequestException('A picked move is in the ledger; do not cancel it');
    await conn.query(`UPDATE inventory_moves SET state = 'cancelled', updated_at = now() WHERE id = $1`, [moveId]);
    return this.get(ctx, transferId);
  }

  // ── State ──────────────────────────────────────────────────────────────────────

  /** Picking starts: draft -> in_progress, the move lines are confirmed. */
  async start(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const t = await this.editable(ctx, conn, scope, id);
    await this.transition(t.state, 'in_progress');
    await conn.transaction(async (m: Queryable) => {
      await m.query(`UPDATE inventory_transfers SET state = 'in_progress', updated_by = $1, updated_at = now() WHERE id = $2`,
        [ctx.user?.sub ?? null, id]);
      await m.query(`UPDATE inventory_moves SET state = 'confirmed', updated_at = now() WHERE transfer_id = $1 AND state = 'draft'`, [id]);
    });
    await this.record(ctx, ENTITY.transfer, id, 'updated', `Transfer ${t.name} is being processed`);
    return this.get(ctx, id);
  }

  /**
   * Mark done: apply every open move to the stock quants in one transaction, close the document,
   * and hand the moves to the Python valuation engine. A failing move rolls back the whole transfer
   * — nothing is left half-applied (all-or-nothing).
   */
  async validate(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const t = await this.editable(ctx, conn, scope, id);
    if (['draft', 'waiting', 'ready'].includes(String(t.state))) t.state = 'in_progress';
    await this.transition(t.state, 'done');
    const moves = await conn.query(
      `SELECT m.*, p.cost_price FROM inventory_moves m
         JOIN products p ON p.id = m.product_id
        WHERE m.transfer_id = $1 AND m.state IN ('draft', 'confirmed', 'assigned') ORDER BY m.created_at, m.id`,
      [id],
    );
    if (!moves.length) throw new BadRequestException('This transfer has no moves to post');

    const ledger: LedgerMove[] = (moves as Record<string, unknown>[]).map((m) => ({
      id: m.id as string,
      product_id: m.product_id as string,
      lot_id: (m.lot_id as string | null) ?? null,
      from_location_id: (m.from_location_id as string | null) ?? null,
      to_location_id: (m.to_location_id as string | null) ?? null,
      quantity: m.quantity as string | number,
      // Outbound never changes a quant's cost; inbound carries the given cost or the product's cost_price.
      inbound_cost: Number(m.unit_cost ?? 0) > 0 ? Number(m.unit_cost ?? 0) : Number(m.cost_price ?? 0),
      company_id: (t.company_id as string | null) ?? null,
      branch_id: (t.branch_id as string | null) ?? null,
    }));

    const negative = new Map<string, boolean>();
    for (const lm of ledger) {
      if (!negative.has(lm.product_id)) negative.set(lm.product_id, await this.allowsNegative(conn, lm.product_id, lm.company_id));
    }
    await conn.transaction(async (m: Queryable) => {
      for (const lm of ledger) {
        await this.placeMove(m, t as Record<string, unknown>, lm);
        if (!lm.from_location_id && !lm.to_location_id) {
          throw new BadRequestException('A move has neither a source nor a destination; set the warehouses on the transfer');
        }
        await this.applyMove(m, lm, { allowNegative: negative.get(lm.product_id) ?? false, actorId: ctx.user?.sub });
      }
      await m.query(
        `UPDATE inventory_transfers SET state = 'done', done_date = now(), updated_by = $1, updated_at = now() WHERE id = $2`,
        [ctx.user?.sub ?? null, id],
      );
    });

    await this.record(ctx, ENTITY.transfer, id, 'updated', `Transfer ${t.name} done; stock moved`);
    await this.valuation.notify(ctx.tenantId, ledger
      .map((lm) => ({
        move_id: lm.id, product_id: lm.product_id, lot_id: lm.lot_id, from_location_id: lm.from_location_id,
        to_location_id: lm.to_location_id, quantity: lm.quantity, unit_cost: lm.inbound_cost ?? 0,
        company_id: lm.company_id, branch_id: lm.branch_id,
      })));
    return this.get(ctx, id);
  }

  /** Open transfers only: undo the document and its draft moves. */
  async cancel(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const t = await this.editable(ctx, conn, scope, id);
    await this.transition(String(t.state), 'cancelled');
    await conn.transaction(async (m: Queryable) => {
      await m.query(`UPDATE inventory_transfers SET state = 'cancelled', updated_by = $1, updated_at = now() WHERE id = $2`,
        [ctx.user?.sub ?? null, id]);
      await m.query(`UPDATE inventory_moves SET state = 'cancelled', updated_at = now() WHERE transfer_id = $1 AND state <> 'done'`, [id]);
    });
    await this.record(ctx, ENTITY.transfer, id, 'note', `Transfer ${t.name} cancelled`);
    return this.get(ctx, id);
  }

  /**
   * Delete a not-yet-posted transfer (draft / in-progress / cancelled). A done transfer has already
   * posted to the append-only ledger and can never be removed — cancel it instead. The moves that
   * were still open are dropped with it (ON DELETE CASCADE on the transfer FK).
   */
  async delete(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const t = await this.findVisible<TransferRow>(conn, scope, 'inventory_transfers', id, 'transfer');
    if (t.state === 'done') {
      throw new BadRequestException('A done transfer is in the stock ledger and cannot be deleted; cancel it instead');
    }
    await conn.query(`DELETE FROM inventory_transfers WHERE id = $1`, [id]);
    await this.record(ctx, ENTITY.transfer, id, 'deleted', `Transfer ${t.name} deleted (not yet posted)`);
    return { id, deleted: true };
  }

  /** Transfer + move CSV for the reports export. */
  async exportCsv(ctx: CatalogContext, q: ListTransfersQueryDto): Promise<string> {
    const { data } = await this.list(ctx, { ...q, limit: 200, page: 1 });
    const rows = data as Record<string, unknown>[];
    const head = ['Number', 'Type', 'State', 'From warehouse', 'To warehouse', 'Scheduled', 'Partner', 'Reason'];
    const body = rows.map((r) => [r.name, r.transfer_type, r.state, r.from_warehouse_id ?? '', r.to_warehouse_id ?? '', r.scheduled_date ?? '', r.partner_name ?? '', r.reason ?? ''].map(csvCell).join(','));
    return [head.map(csvCell).join(','), ...body].join('\n');
  }

  /**
   * A move line without explicit locations uses the warehouse's virtual location:
   * receipts land in input, deliveries come from output, internal moves use stock.
   */
  private async placeMove(client: Queryable, t: Record<string, unknown>, m: LedgerMove): Promise<void> {
    for (const side of SIDES[String(t.transfer_type)] ?? []) {
      if (side === 'to' ? m.to_location_id : m.from_location_id) continue;
      const warehouseId = side === 'to' ? t.to_warehouse_id : t.from_warehouse_id;
      if (!warehouseId) {
        throw new BadRequestException(`This ${String(t.transfer_type).replace('_', ' ')} has no ${side === 'to' ? 'destination' : 'source'} warehouse; set one on the transfer`);
      }
      const [wh] = await client.query(`SELECT * FROM inventory_warehouses WHERE id = $1`, [warehouseId]);
      if (!wh) throw new NotFoundException('That warehouse no longer exists');
      const locationId = wh.stock_location_id as string | null;
      if (!locationId) throw new BadRequestException(`Warehouse ${wh.name} has no stock location; set it up first`);
      if (side === 'to') m.to_location_id = locationId;
      else m.from_location_id = locationId;
      await client.query(
        `UPDATE inventory_moves SET ${side === 'to' ? 'to_location_id' : 'from_location_id'} = $1, updated_at = now() WHERE id = $2`,
        [locationId, m.id],
      );
    }
    if (m.from_location_id && m.from_location_id === m.to_location_id) {
      throw new BadRequestException('A move cannot go from a location to the same location');
    }
  }

  private async insertMove(client: Queryable, transferId: string, transferType: string, m: Record<string, unknown>,
    place: { company_id: string | null; branch_id?: string | null }, actorId?: string | null) {
    const [move] = await client.query(
      `INSERT INTO inventory_moves
         (transfer_id, move_type, product_id, lot_id, from_location_id, to_location_id, quantity, unit_cost,
          state, source, operator_user_id, company_id, branch_id, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 'transfer', $9, $10, $11, $12, $12)
       RETURNING *`,
      [transferId, m.move_type ?? transferType, m.product_id, (m.lot_id as string | null) ?? null,
        (m.from_location_id as string | null) ?? null, (m.to_location_id as string | null) ?? null,
        m.quantity, Number(m.unit_cost ?? 0), actorId ?? null, place.company_id, place.branch_id ?? null, actorId ?? null],
    );
    return move;
  }

  /** A transfer that can still change: visible, and neither done nor cancelled. */
  private async editable(ctx: CatalogContext, conn: Queryable, scope: import('../../common/records/record-scope').CompanyScope, id: string) {
    const t = await this.findVisible<TransferRow>(conn, scope, 'inventory_transfers', id, 'transfer');
    if (t.state === 'done') throw new BadRequestException(`${t.name} is done; its stock is in the ledger`);
    if (t.state === 'cancelled') throw new BadRequestException(`${t.name} is cancelled`);
    return t;
  }

  /** A move line's product, lot and locations must be usable in the person's scope (rules 16, 20). */
  private async checkLine(conn: Queryable, scope: import('../../common/records/record-scope').CompanyScope, m: CreateMoveDto) {
    await this.visibleProduct(conn, scope, m.product_id);
    if (m.lot_id) await this.visibleLot(conn, scope, m.lot_id, m.product_id);
    if (m.from_location_id) await this.usableLocation(conn, scope, m.from_location_id);
    if (m.to_location_id) await this.usableLocation(conn, scope, m.to_location_id);
  }

  private transition(from: string, to: string) {
    const allowed = STATE_FLOW[from] ?? [];
    if (!allowed.includes(to as typeof TRANSFER_STATES[number])) {
      throw new BadRequestException(`A transfer in ${from} cannot move to ${to}`);
    }
  }

  private kindOf(transferType: string): string {
    if (transferType === 'internal') return 'internal';
    if (transferType === 'delivery' || transferType === 'return_out') return 'delivery';
    return 'receipt';
  }

  private clean(dto: object): Record<string, unknown> {
    const out: Record<string, unknown> = { ...(dto as Record<string, unknown>) };
    for (const k of COLUMNS) if (out[k] !== undefined) out[k] = blankToNull(out[k]);
    return out;
  }

  private async checkUser(conn: Queryable, id: string) {
    const [u] = await conn.query(`SELECT id FROM users WHERE id = $1 AND COALESCE(is_active, true)`, [id]);
    if (!u) throw new BadRequestException('That responsible user is not an active user');
  }
}
