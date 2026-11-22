import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from './products.service';
import { isVisible, resolveCompanyScope, type Queryable } from './products.scope';

/**
 * Customer price lists (featureslist §1): a customer buys at its list's prices (wholesale, VIP,
 * a contract price list for one customer). A customer is on one list at most; with none, the
 * default list applies. Sales and POS ask /price-lists/price?customer_id=…
 */
@Injectable()
export class PriceListCustomersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async customers(ctx: CatalogContext, listId: string) {
    const { conn } = await this.openList(ctx, listId);
    return conn.query(
      `SELECT c.id, c.code, c.name, c.contact_type, c.phone, c.email, c.city, plc.created_at AS added_at
         FROM price_list_customers plc JOIN contacts c ON c.id = plc.contact_id
        WHERE plc.price_list_id = $1 ORDER BY lower(c.name)`,
      [listId],
    );
  }

  /** Replaces the list's customers. A customer moving from another list is taken off that one. */
  async setCustomers(ctx: CatalogContext, listId: string, contactIds: string[]) {
    const { conn, scope, list } = await this.openList(ctx, listId);
    if (!list.is_active) throw new BadRequestException('Restore the price list first');
    const ids = [...new Set(contactIds)];
    if (ids.length) {
      const rows: { id: string; name: string; is_active: boolean; company_id: string | null; branch_id?: string | null; parent_id: string | null }[] = await conn.query(
        `SELECT id, name, is_active, company_id, branch_id, parent_id FROM contacts WHERE id = ANY($1::uuid[])`, [ids],
      );
      for (const id of ids) {
        const r = rows.find((x) => x.id === id);
        if (!r || !isVisible(scope, r.company_id, r.branch_id)) throw new BadRequestException('A customer was not found');
        if (!r.is_active) throw new BadRequestException(`"${r.name}" is archived`);
        if (r.parent_id) throw new BadRequestException(`"${r.name}" is a person at a company; put the company on the list`);
      }
    }
    const before: { id: string }[] = await this.customers(ctx, listId);
    const moved: { name: string; list_name: string }[] = ids.length
      ? await conn.query(
          `SELECT c.name, l.name AS list_name FROM price_list_customers plc JOIN contacts c ON c.id = plc.contact_id
             JOIN price_lists l ON l.id = plc.price_list_id WHERE plc.contact_id = ANY($1::uuid[]) AND plc.price_list_id <> $2`,
          [ids, listId],
        )
      : [];
    await conn.transaction(async (m: Queryable) => {
      await m.query(`DELETE FROM price_list_customers WHERE price_list_id = $1 AND NOT (contact_id = ANY($2::uuid[]))`, [listId, ids]);
      for (const id of ids) {
        await m.query(
          `INSERT INTO price_list_customers (contact_id, price_list_id, created_by) VALUES ($1, $2, $3)
           ON CONFLICT (contact_id) DO UPDATE SET price_list_id = EXCLUDED.price_list_id, created_by = EXCLUDED.created_by, created_at = now()
           WHERE price_list_customers.price_list_id <> EXCLUDED.price_list_id`,
          [id, listId, ctx.user?.sub ?? null],
        );
      }
    });
    const added = ids.filter((id) => !before.some((b) => b.id === id)).length;
    const removed = before.filter((b) => !ids.includes(b.id)).length;
    if (added || removed) {
      await this.timeline.record(ctx.tenantId, {
        entityType: 'price_list', entityId: listId, eventType: 'updated', moduleKey: 'products',
        summary: `Customers on "${list.name}": ${added} added, ${removed} removed${moved.length ? ` (${moved.map((x) => `${x.name} moved from ${x.list_name}`).join(', ')})` : ''}`,
        actorId: ctx.user?.sub, client: ctx.client,
      });
    }
    return this.customers(ctx, listId);
  }

  /** The list a customer buys at: its own list, else the default list. */
  async forCustomer(ctx: CatalogContext, contactId: string) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const scope = await resolveCompanyScope(conn, ctx.user, ctx.companyHeader, ctx.branchHeader);
    const [contact] = await conn.query(`SELECT id, company_id, branch_id, parent_id FROM contacts WHERE id = $1`, [contactId]);
    if (!contact || !isVisible(scope, contact.company_id, contact.branch_id)) throw new NotFoundException('Customer not found');
    const id = await customerListId(conn, contact.parent_id ?? contactId);
    return { contact_id: contactId, price_list_id: id, source: id ? 'customer' : 'default' };
  }

  private async openList(ctx: CatalogContext, listId: string) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const scope = await resolveCompanyScope(conn, ctx.user, ctx.companyHeader, ctx.branchHeader);
    const [list] = await conn.query(`SELECT id, name, is_active, company_id, branch_id FROM price_lists WHERE id = $1`, [listId]);
    if (!list || !isVisible(scope, list.company_id, list.branch_id)) throw new NotFoundException('Price list not found');
    return { conn, scope, list };
  }
}

/** The active list a customer (or the company a person works at) is on, or null. */
export async function customerListId(conn: Queryable, contactId: string): Promise<string | null> {
  const [row] = await conn.query(
    `SELECT plc.price_list_id FROM contacts c
       JOIN price_list_customers plc ON plc.contact_id = COALESCE(c.parent_id, c.id)
       JOIN price_lists l ON l.id = plc.price_list_id AND l.is_active
      WHERE c.id = $1`,
    [contactId],
  );
  return row?.price_list_id ?? null;
}
