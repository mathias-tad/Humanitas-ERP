import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from '../products/products.service';
import { csvCell } from '../products/products.service';
import {
  assertCompanyAssignable, companyFilter, defaultRecordCompany, isVisible, resolveCompanyScope, type CompanyScope, type Queryable, defaultRecordBranch, assertBranchAssignable, setRecordBranch
} from '../products/products.scope';
import { cleanTags, duplicateReason, emailKey, normalizeTin, phoneKey, type DuplicateCandidate } from './contacts.rules';
import type {
  ContactCategoryDto, ContactInteractionDto, ContactPersonDto, CreateContactDto, DuplicatesQueryDto, ListContactsQueryDto,
  UpdateContactCategoryDto, UpdateContactDto,
} from './dto/contacts.dto';

/** Fields shown on the contact timeline (featureslist §30). */
export const CONTACT_TRACKED_FIELDS: Record<string, string> = {
  name: 'Name', legal_name: 'Legal name', contact_type: 'Type', code: 'Code', parent_name: 'Company', job_title: 'Job title',
  is_primary_contact: 'Primary contact', tin: 'TIN', vat_number: 'VAT number', phone: 'Phone', mobile: 'Mobile', email: 'Email',
  website: 'Website', region: 'Region', city: 'City', subcity: 'Sub-city', woreda: 'Woreda', street: 'Street',
  category_name: 'Category', tags: 'Tags', is_customer: 'Customer', is_vendor: 'Vendor', price_list_name: 'Price list',
  credit_limit: 'Credit limit', payment_terms_days: 'Payment terms (days)', account_manager_name: 'Account manager',
  notes: 'Notes', is_active: 'Active',
};

const COLUMNS = [
  'code', 'contact_type', 'parent_id', 'is_primary_contact', 'job_title', 'name', 'legal_name', 'tin', 'vat_number', 'phone', 'mobile',
  'email', 'website', 'country', 'region', 'city', 'subcity', 'woreda', 'street', 'category_id', 'tags', 'is_customer', 'is_vendor',
  'price_list_id', 'credit_limit', 'payment_terms_days', 'account_manager_id', 'notes', 'company_id', 'branch_id',
] as const;
type Column = (typeof COLUMNS)[number];
type Row = Partial<Record<Column, unknown>>;

const DETAIL_SQL = `
  SELECT c.*, par.name AS parent_name, cat.name AS category_name, cat.color AS category_color, pl.name AS price_list_name,
         COALESCE(c.price_list_id, cat.price_list_id) AS effective_price_list_id,
         u.full_name AS account_manager_name,
         (SELECT count(*)::int FROM contacts p WHERE p.parent_id = c.id AND p.is_active) AS people_count,
         (SELECT p.name FROM contacts p WHERE p.parent_id = c.id AND p.is_active AND p.is_primary_contact LIMIT 1) AS primary_contact
    FROM contacts c
    LEFT JOIN contacts par ON par.id = c.parent_id
    LEFT JOIN contact_categories cat ON cat.id = c.category_id
    LEFT JOIN price_lists pl ON pl.id = c.price_list_id
    LEFT JOIN users u ON u.id = c.account_manager_id`;

const SORTS: Record<string, string> = { name: 'lower(c.name)', code: 'lower(c.code)', created_at: 'c.created_at', updated_at: 'c.updated_at' };

const blankToNull = (v: unknown) => (typeof v === 'string' ? v.trim() || null : v);

/** Companies and people shared by every module (featureslist §4.1, CRM 1.3): customers, vendors and their people. */
@Injectable()
export class ContactsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  private async open(ctx: CatalogContext) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const scope = await resolveCompanyScope(conn, ctx.user, ctx.companyHeader, ctx.branchHeader);
    return { conn, scope };
  }

  // ── Contacts ───────────────────────────────────────────────────────────────────
  async list(ctx: CatalogContext, q: ListContactsQueryDto) {
    const { conn, scope } = await this.open(ctx);
    const { where, params } = this.filters(scope, q);
    const limit = Math.min(q.limit ?? 40, 200);
    const page = q.page ?? 1;
    const sort = `${SORTS[q.sort ?? 'name'] ?? SORTS.name} ${q.order === 'desc' ? 'DESC' : 'ASC'}`;
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [{ total }] = await conn.query(`SELECT count(*)::int AS total FROM contacts c ${w}`, params);
    const data = await conn.query(
      `${DETAIL_SQL} ${w} ORDER BY ${sort}, c.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    return { data, meta: { page, limit, total } };
  }

  /** A contact; a company comes with its people. */
  async get(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const contact = await this.findVisible(conn, scope, id);
    const people = contact.contact_type === 'company'
      ? await conn.query(`${DETAIL_SQL} WHERE c.parent_id = $1 AND c.is_active ORDER BY c.is_primary_contact DESC, lower(c.name)`, [id])
      : [];
    return { ...contact, people };
  }

  /** Contacts that look like the one being entered (same TIN, phone or email). */
  async duplicates(ctx: CatalogContext, q: DuplicatesQueryDto) {
    const { conn, scope } = await this.open(ctx);
    let tin: string | null = null;
    try {
      tin = normalizeTin(q.tin);
    } catch {
      tin = null;
    }
    const phones = [phoneKey(q.phone), phoneKey(q.mobile)].filter((p): p is string => !!p);
    const email = emailKey(q.email);
    if (!tin && !phones.length && !email) return [];
    const params: unknown[] = [tin, phones, email, q.exclude_id ?? null];
    const f = companyFilter(scope, 'c', params.length + 1);
    if (f) params.push(f.param);
    const rows: DuplicateCandidate[] = await conn.query(
      `SELECT c.id, c.code, c.name, c.tin, c.phone, c.mobile, c.email FROM contacts c
        WHERE c.is_active AND ($4::uuid IS NULL OR c.id <> $4)
          AND ((c.tin IS NOT NULL AND c.tin = $1)
            OR regexp_replace(COALESCE(c.phone, ''), '\\D', '', 'g') <> '' AND right(regexp_replace(c.phone, '\\D', '', 'g'), 9) = ANY(SELECT right(x, 9) FROM unnest($2::text[]) x)
            OR regexp_replace(COALESCE(c.mobile, ''), '\\D', '', 'g') <> '' AND right(regexp_replace(c.mobile, '\\D', '', 'g'), 9) = ANY(SELECT right(x, 9) FROM unnest($2::text[]) x)
            OR ($3::text IS NOT NULL AND lower(c.email) = $3))
          ${f ? `AND ${f.sql}` : ''}
        ORDER BY lower(c.name) LIMIT 10`,
      params,
    );
    return rows
      .map((c) => ({ ...c, reason: duplicateReason({ tin, phone: q.phone, mobile: q.mobile, email }, c) }))
      .filter((c) => c.reason);
  }

  async create(ctx: CatalogContext, dto: CreateContactDto) {
    const { conn, scope } = await this.open(ctx);
    const row = this.clean(dto);
    row.contact_type = row.contact_type ?? (row.parent_id ? 'person' : 'company');
    const parent = await this.checkParent(conn, scope, row);
    const companyId = dto.company_id !== undefined ? dto.company_id : parent ? parent.company_id : defaultRecordCompany(scope);
    assertCompanyAssignable(scope, companyId);
    row.company_id = companyId ?? null;
    // A person belongs where their company does; otherwise the picked branch (null = every branch).
    row.branch_id = dto.branch_id !== undefined ? dto.branch_id : parent ? parent.branch_id ?? null : defaultRecordBranch(scope);
    assertBranchAssignable(scope, row.branch_id as string | null);
    await this.checkLinks(conn, scope, row);
    if (row.tin && !dto.allow_duplicate) await this.refuseSameTin(conn, scope, row.tin as string, null);
    const people = row.contact_type === 'company' ? (dto.people ?? []).filter((p) => p.name?.trim()) : [];
    const id = await conn
      .transaction(async (m: Queryable) => {
        if (row.parent_id && row.is_primary_contact) await this.clearPrimary(m, row.parent_id as string, null);
        if (row.parent_id && row.is_primary_contact === undefined) {
          const [{ n }] = await m.query(`SELECT count(*)::int AS n FROM contacts WHERE parent_id = $1 AND is_active`, [row.parent_id]);
          row.is_primary_contact = n === 0;
        }
        const newId = await this.insert(m, row, ctx);
        for (let i = 0; i < people.length; i++) {
          await this.insert(m, { ...this.personRow(people[i], newId, i === 0, row.company_id as string | null), branch_id: row.branch_id ?? null }, ctx);
        }
        return newId;
      })
      .catch((e: unknown) => this.rethrow(e));
    await this.timeline.record(ctx.tenantId, {
      entityType: 'contact', entityId: id, eventType: 'created', moduleKey: 'contacts',
      summary: `${row.contact_type === 'person' ? 'Person' : 'Company'} "${row.name}" created${parent ? ` at ${parent.name}` : ''}`,
      actorId: ctx.user?.sub, client: ctx.client,
    });
    if (parent) {
      await this.timeline.record(ctx.tenantId, {
        entityType: 'contact', entityId: parent.id, eventType: 'updated', moduleKey: 'contacts',
        summary: `${row.name} added to the people at ${parent.name}`, actorId: ctx.user?.sub, client: ctx.client,
      });
    }
    return this.get(ctx, id);
  }

  async update(ctx: CatalogContext, id: string, dto: UpdateContactDto) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findVisible(conn, scope, id);
    const { people: _people, allow_duplicate, ...fields } = dto;
    void _people;
    const row = this.clean(fields);
    if (row.contact_type === 'company' && before.contact_type === 'person' && (row.parent_id ?? before.parent_id)) {
      throw new BadRequestException('A person who belongs to a company cannot become a company; remove the company first');
    }
    if (row.contact_type === 'person' && before.contact_type === 'company') {
      const [{ n }] = await conn.query(`SELECT count(*)::int AS n FROM contacts WHERE parent_id = $1 AND is_active`, [id]);
      if (n > 0) throw new BadRequestException(`${before.name} has ${n} ${n === 1 ? 'person' : 'people'}; a company with people cannot become a person`);
    }
    if (row.parent_id !== undefined) {
      if (row.parent_id === id) throw new BadRequestException('A contact cannot belong to itself');
      await this.checkParent(conn, scope, { ...before, ...row });
    }
    if (row.company_id !== undefined) assertCompanyAssignable(scope, row.company_id as string | null);
    assertBranchAssignable(scope, row.branch_id as string | null | undefined);
    await this.checkLinks(conn, scope, row);
    if (row.tin && row.tin !== before.tin && !allow_duplicate) await this.refuseSameTin(conn, scope, row.tin as string, id);
    const cols = (Object.keys(row) as Column[]).filter((c) => row[c] !== undefined);
    if (!cols.length) return this.get(ctx, id);
    await conn
      .transaction(async (m: Queryable) => {
        const parentId = (row.parent_id !== undefined ? row.parent_id : before.parent_id) as string | null;
        if (row.is_primary_contact && parentId) await this.clearPrimary(m, parentId, id);
        await m.query(
          `UPDATE contacts SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_by = $${cols.length + 1}, updated_at = now()
            WHERE id = $${cols.length + 2}`,
          [...cols.map((c) => row[c]), ctx.user?.sub ?? null, id],
        );
      })
      .catch((e: unknown) => this.rethrow(e));
    const after = await this.findVisible(conn, scope, id);
    await this.timeline.recordChanges(ctx.tenantId, {
      entityType: 'contact', entityId: id, moduleKey: 'contacts', before, after, fields: CONTACT_TRACKED_FIELDS,
      actorId: ctx.user?.sub, client: ctx.client,
    });
    return this.get(ctx, id);
  }

  /** Delete = archive (rule 24): hidden from lists and pickers; history, orders and invoices keep it. */
  archive(ctx: CatalogContext, id: string) {
    return this.setActive(ctx, id, false);
  }

  restore(ctx: CatalogContext, id: string) {
    return this.setActive(ctx, id, true);
  }

  private async setActive(ctx: CatalogContext, id: string, active: boolean) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findVisible(conn, scope, id);
    if (before.is_active === active) return this.get(ctx, id);
    if (active && before.parent_id) {
      const [parent] = await conn.query(`SELECT name, is_active FROM contacts WHERE id = $1`, [before.parent_id]);
      if (parent && !parent.is_active) throw new BadRequestException(`Restore ${parent.name} first; ${before.name} belongs to it`);
    }
    await conn.transaction(async (m: Queryable) => {
      await m.query(
        `UPDATE contacts SET is_active = $1, is_primary_contact = CASE WHEN $1 THEN is_primary_contact ELSE false END, updated_by = $2, updated_at = now() WHERE id = $3`,
        [active, ctx.user?.sub ?? null, id],
      );
      if (!active && before.is_primary_contact && before.parent_id) {
        await m.query(
          `UPDATE contacts SET is_primary_contact = true WHERE id = (
             SELECT id FROM contacts WHERE parent_id = $1 AND is_active AND id <> $2 ORDER BY created_at LIMIT 1)`, [before.parent_id, id],
        );
      }
    });
    await this.timeline.record(ctx.tenantId, {
      entityType: 'contact', entityId: id, eventType: active ? 'restored' : 'deleted', moduleKey: 'contacts',
      summary: `"${before.name}" ${active ? 'restored' : 'archived'}`, actorId: ctx.user?.sub, client: ctx.client,
    });
    return this.get(ctx, id);
  }

  async exportCsv(ctx: CatalogContext, q: ListContactsQueryDto): Promise<string> {
    const { conn, scope } = await this.open(ctx);
    const { where, params } = this.filters(scope, q);
    const rows = await conn.query(
      `${DETAIL_SQL} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY lower(c.name) LIMIT 50000`, params,
    );
    const cols = ['code', 'name', 'contact_type', 'parent_name', 'job_title', 'is_customer', 'is_vendor', 'legal_name', 'tin', 'vat_number',
      'phone', 'mobile', 'email', 'website', 'region', 'city', 'subcity', 'woreda', 'street', 'category_name', 'tags', 'price_list_name',
      'credit_limit', 'payment_terms_days', 'account_manager_name', 'primary_contact', 'is_active'];
    const lines = [cols.join(',')];
    for (const r of rows) lines.push(cols.map((c) => csvCell(Array.isArray(r[c]) ? r[c].join('; ') : r[c])).join(','));
    return lines.join('\r\n');
  }

  async timelineFor(ctx: CatalogContext, id: string, opts: { limit?: number; before?: string }) {
    const { conn, scope } = await this.open(ctx);
    await this.findVisible(conn, scope, id);
    return this.timeline.list(ctx.tenantId, 'contact', id, opts);
  }

  /** Logs a call, meeting, email, visit or note on the contact's history (and on the person's, when one is named). */
  async addInteraction(ctx: CatalogContext, id: string, dto: ContactInteractionDto) {
    const { conn, scope } = await this.open(ctx);
    const contact = await this.findVisible(conn, scope, id);
    let person: { id: string; name: string } | null = null;
    if (dto.person_id) {
      [person] = await conn.query(`SELECT id, name FROM contacts WHERE id = $1 AND parent_id = $2 AND is_active`, [dto.person_id, id]);
      if (!person) throw new BadRequestException(`That person is not one of ${contact.name}'s people`);
    }
    const occurredAt = dto.occurred_at ? new Date(dto.occurred_at) : undefined;
    if (occurredAt && occurredAt.getTime() > Date.now() + 5 * 60 * 1000) throw new BadRequestException('Log what already happened; plan future calls as activities');
    const label = { note: 'Note', call: 'Call', meeting: 'Meeting', email: 'Email', visit: 'Visit', telegram: 'Telegram', whatsapp: 'WhatsApp', sms: 'SMS' }[dto.kind];
    const event = {
      eventType: (dto.kind === 'note' ? 'note' : 'interaction') as 'note' | 'interaction', moduleKey: 'contacts',
      payload: { kind: dto.kind, direction: dto.direction ?? null, person_id: person?.id ?? null, contact_name: contact.name },
      occurredAt, actorId: ctx.user?.sub, client: ctx.client,
    };
    const recorded = await this.timeline.record(ctx.tenantId, {
      ...event, entityType: 'contact', entityId: id, summary: `${label}${person ? ` with ${person.name}` : ''}: ${dto.summary.trim()}`,
    });
    if (person) {
      await this.timeline.record(ctx.tenantId, { ...event, entityType: 'contact', entityId: person.id, summary: `${label} (${contact.name}): ${dto.summary.trim()}` });
    }
    return recorded;
  }

  // ── Categories ─────────────────────────────────────────────────────────────────
  async listCategories(ctx: CatalogContext, includeArchived = false) {
    const { conn, scope } = await this.open(ctx);
    const where: string[] = [];
    const params: unknown[] = [];
    if (!includeArchived) where.push('k.is_active');
    const f = companyFilter(scope, 'k', 1);
    if (f) {
      params.push(f.param);
      where.push(f.sql);
    }
    return conn.query(
      `SELECT k.*, pl.name AS price_list_name,
              (SELECT count(*)::int FROM contacts c WHERE c.category_id = k.id AND c.is_active) AS contact_count
         FROM contact_categories k LEFT JOIN price_lists pl ON pl.id = k.price_list_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY k.sort_order, lower(k.name)`,
      params,
    );
  }

  async createCategory(ctx: CatalogContext, dto: ContactCategoryDto) {
    const { conn, scope } = await this.open(ctx);
    const companyId = dto.company_id !== undefined ? dto.company_id : defaultRecordCompany(scope);
    assertCompanyAssignable(scope, companyId);
    const branchId = dto.branch_id !== undefined ? dto.branch_id : defaultRecordBranch(scope);
    assertBranchAssignable(scope, branchId);
    if (dto.price_list_id) await this.checkPriceList(conn, scope, dto.price_list_id);
    const [row] = await conn
      .query(
        `INSERT INTO contact_categories (name, description, color, price_list_id, company_id, sort_order, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, (SELECT COALESCE(max(sort_order), 0) + 1 FROM contact_categories)), $7, $7) RETURNING *`,
        [dto.name.trim(), blankToNull(dto.description) ?? null, dto.color ?? null, dto.price_list_id ?? null, companyId ?? null, dto.sort_order ?? null, ctx.user?.sub ?? null],
      )
      .catch((e: unknown) => this.rethrow(e));
    if (branchId) {
      await setRecordBranch(conn, 'contact_categories', row.id, branchId);
      row.branch_id = branchId;
    }
    return row;
  }

  async updateCategory(ctx: CatalogContext, id: string, dto: UpdateContactCategoryDto) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findCategory(conn, scope, id);
    if (dto.company_id !== undefined) assertCompanyAssignable(scope, dto.company_id);
    assertBranchAssignable(scope, dto.branch_id);
    if (dto.price_list_id) await this.checkPriceList(conn, scope, dto.price_list_id);
    if (dto.is_active === false) {
      const [{ n }] = await conn.query(`SELECT count(*)::int AS n FROM contacts WHERE category_id = $1 AND is_active`, [id]);
      if (n > 0) throw new BadRequestException(`${n} active contact${n === 1 ? ' is' : 's are'} in this category; move them first`);
    }
    const fields = ['name', 'description', 'color', 'price_list_id', 'company_id', 'branch_id', 'sort_order', 'is_active'] as const;
    const changes = fields.filter((f) => dto[f] !== undefined);
    if (!changes.length) return before;
    const [row] = await conn
      .query(
        `UPDATE contact_categories SET ${changes.map((f, i) => `${f} = $${i + 1}`).join(', ')}, updated_by = $${changes.length + 1}, updated_at = now()
          WHERE id = $${changes.length + 2} RETURNING *`,
        [...changes.map((f) => (f === 'name' ? String(dto.name).trim() : blankToNull(dto[f]))), ctx.user?.sub ?? null, id],
      )
      .catch((e: unknown) => this.rethrow(e));
    return row;
  }

  archiveCategory(ctx: CatalogContext, id: string) {
    return this.updateCategory(ctx, id, { is_active: false });
  }

  // ── helpers ────────────────────────────────────────────────────────────────────
  private filters(scope: CompanyScope, q: ListContactsQueryDto) {
    const where: string[] = [];
    const params: unknown[] = [];
    const status = q.status ?? 'active';
    if (status === 'active') where.push('c.is_active');
    if (status === 'archived') where.push('NOT c.is_active');
    if (q.q?.trim()) {
      const term = q.q.trim().toLowerCase();
      params.push(`%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
      const like = `$${params.length}`;
      const digits = term.replace(/\D/g, '');
      const phoneClause = digits.length >= 6
        ? ` OR regexp_replace(COALESCE(c.phone, '') || ' ' || COALESCE(c.mobile, ''), '\\D', '', 'g') LIKE '%' || $${params.push(digits.slice(-9))} || '%'`
        : '';
      where.push(`(lower(c.name) LIKE ${like} OR lower(c.code) LIKE ${like} OR lower(COALESCE(c.legal_name, '')) LIKE ${like}
        OR COALESCE(c.tin, '') LIKE ${like} OR lower(COALESCE(c.email, '')) LIKE ${like}${phoneClause}
        OR EXISTS (SELECT 1 FROM contacts p WHERE p.parent_id = c.id AND p.is_active AND lower(p.name) LIKE ${like}))`);
    }
    if (q.role === 'customer') where.push('c.is_customer');
    if (q.role === 'vendor') where.push('c.is_vendor');
    if (q.contact_type) where.push(`c.contact_type = $${params.push(q.contact_type)}`);
    if (q.parent_id) where.push(`c.parent_id = $${params.push(q.parent_id)}`);
    if (q.category_id) where.push(`c.category_id = $${params.push(q.category_id)}`);
    if (q.tag) where.push(`$${params.push(q.tag)} ILIKE ANY(c.tags)`);
    if (q.account_manager_id) where.push(`c.account_manager_id = $${params.push(q.account_manager_id)}`);
    const f = companyFilter(scope, 'c', params.length + 1);
    if (f) {
      params.push(f.param);
      where.push(f.sql);
    }
    return { where, params };
  }

  /** The columns a request sets, cleaned (blank text = empty, TIN checked, tags tidied). */
  private clean(dto: Partial<CreateContactDto>): Row {
    const out: Row = {};
    for (const c of COLUMNS) {
      const v = (dto as Record<string, unknown>)[c];
      if (v === undefined) continue;
      out[c] = c === 'tags' ? cleanTags(v as string[]) : blankToNull(v);
    }
    if (out.name !== undefined && !out.name) throw new BadRequestException('A contact needs a name');
    if (out.code === null) delete out.code;
    if (out.tin !== undefined) {
      try {
        out.tin = normalizeTin(out.tin as string | null);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
    }
    if (out.email) out.email = String(out.email).toLowerCase();
    return out;
  }

  private personRow(p: ContactPersonDto, parentId: string, primary: boolean, companyId: string | null): Row {
    return {
      ...this.clean({ name: p.name, job_title: p.job_title, phone: p.phone, mobile: p.mobile, email: p.email }),
      contact_type: 'person', parent_id: parentId, is_primary_contact: primary, company_id: companyId,
    };
  }

  private async insert(m: Queryable, row: Row, ctx: CatalogContext): Promise<string> {
    const cols = (Object.keys(row) as Column[]).filter((c) => row[c] !== undefined);
    const [created] = await m.query(
      `INSERT INTO contacts (${cols.join(', ')}, created_by, updated_by)
       VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, $${cols.length + 1}, $${cols.length + 1}) RETURNING id`,
      [...cols.map((c) => row[c]), ctx.user?.sub ?? null],
    );
    return created.id as string;
  }

  /** A person's company must be an active company contact the user can see. */
  private async checkParent(conn: Queryable, scope: CompanyScope, row: Row) {
    if (!row.parent_id) return null;
    if (row.contact_type === 'company') throw new BadRequestException('Only a person belongs to a company');
    const [parent] = await conn.query(`SELECT id, name, contact_type, company_id, branch_id, is_active FROM contacts WHERE id = $1`, [row.parent_id]);
    if (!parent || !isVisible(scope, parent.company_id, parent.branch_id)) throw new BadRequestException('That company was not found');
    if (parent.contact_type !== 'company') throw new BadRequestException(`${parent.name} is a person; a person belongs to a company`);
    if (!parent.is_active) throw new BadRequestException(`${parent.name} is archived`);
    return parent as { id: string; name: string; company_id: string | null; branch_id?: string | null };
  }

  private async clearPrimary(m: Queryable, parentId: string, exceptId: string | null) {
    await m.query(`UPDATE contacts SET is_primary_contact = false WHERE parent_id = $1 AND is_primary_contact AND ($2::uuid IS NULL OR id <> $2)`, [parentId, exceptId]);
  }

  private async checkLinks(conn: Queryable, scope: CompanyScope, row: Row) {
    if (row.category_id) {
      const [k] = await conn.query(`SELECT id, company_id, branch_id, is_active FROM contact_categories WHERE id = $1`, [row.category_id]);
      if (!k || !isVisible(scope, k.company_id, k.branch_id) || !k.is_active) throw new BadRequestException('That contact category was not found');
    }
    if (row.price_list_id) await this.checkPriceList(conn, scope, row.price_list_id as string);
    if (row.account_manager_id) {
      const [u] = await conn.query(`SELECT id FROM users WHERE id = $1 AND COALESCE(is_active, true)`, [row.account_manager_id]);
      if (!u) throw new BadRequestException('That account manager is not an active user');
    }
  }

  private async refuseSameTin(conn: Queryable, scope: CompanyScope, tin: string, excludeId: string | null) {
    const rows: { id: string; code: string; name: string; company_id: string | null; branch_id?: string | null }[] = await conn.query(
      `SELECT id, code, name, company_id, branch_id FROM contacts WHERE tin = $1 AND is_active AND ($2::uuid IS NULL OR id <> $2) LIMIT 5`, [tin, excludeId],
    );
    const same = rows.find((r) => isVisible(scope, r.company_id, r.branch_id));
    if (same) throw new ConflictException(`${same.name} (${same.code}) already has TIN ${tin}. Open that contact, or save anyway if they are different.`);
  }

  private async checkPriceList(conn: Queryable, scope: CompanyScope, id: string) {
    const [list] = await conn.query(`SELECT id, company_id, branch_id, is_active FROM price_lists WHERE id = $1`, [id]);
    if (!list || !isVisible(scope, list.company_id, list.branch_id)) throw new BadRequestException('Price list not found');
    if (!list.is_active) throw new BadRequestException('This price list is archived');
  }

  private async findVisible(conn: Queryable, scope: CompanyScope, id: string) {
    const [row] = await conn.query(`${DETAIL_SQL} WHERE c.id = $1`, [id]);
    if (!row || !isVisible(scope, row.company_id, row.branch_id)) throw new NotFoundException('Contact not found');
    return row;
  }

  private async findCategory(conn: Queryable, scope: CompanyScope, id: string) {
    const [row] = await conn.query(`SELECT * FROM contact_categories WHERE id = $1`, [id]);
    if (!row || !isVisible(scope, row.company_id, row.branch_id)) throw new NotFoundException('Contact category not found');
    return row;
  }

  private rethrow(e: unknown): never {
    const err = e as { code?: string; constraint?: string };
    if (err?.code === '23505') {
      if (err.constraint === 'uq_contacts_code') throw new ConflictException('Another contact already has this code');
      if (err.constraint === 'uq_contact_categories_name') throw new ConflictException('A contact category with this name already exists');
      throw new ConflictException('This would duplicate an existing record');
    }
    if (err?.code === '23514' && err.constraint?.includes('tin')) throw new BadRequestException('A TIN is 10 digits');
    throw e;
  }
}
