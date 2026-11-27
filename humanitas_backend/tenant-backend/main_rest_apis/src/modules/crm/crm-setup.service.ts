import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from '../../common/records/record-context';
import { assertCompanyAssignable, companyFilter, defaultRecordCompany, isVisible, type CompanyScope, type Queryable, defaultRecordBranch, assertBranchAssignable, setRecordBranch } from '../../common/records/record-scope';
import { CrmBase, setClause } from './crm.base';
import type { ListItemDto, PipelineDto, ReorderStagesDto, StageDto, UpdateListItemDto, UpdatePipelineDto, UpdateStageDto } from './dto/crm.dto';

/** The stages a new pipeline starts with. */
export const DEFAULT_STAGES = [
  { name: 'New', probability: 10, rotting_days: 7, is_won: false, is_lost: false },
  { name: 'Qualified', probability: 25, rotting_days: 14, is_won: false, is_lost: false },
  { name: 'Proposal', probability: 50, rotting_days: 14, is_won: false, is_lost: false },
  { name: 'Negotiation', probability: 75, rotting_days: 14, is_won: false, is_lost: false },
  { name: 'Won', probability: 100, rotting_days: null, is_won: true, is_lost: false },
  { name: 'Lost', probability: 0, rotting_days: null, is_won: false, is_lost: true },
];

export interface StageRow {
  id: string;
  pipeline_id: string;
  name: string;
  probability: number;
  rotting_days: number | null;
  is_won: boolean;
  is_lost: boolean;
  sort_order: number;
  is_active: boolean;
}

/** CRM set-up: pipelines and their stages, lead sources and lost reasons. */
@Injectable()
export class CrmSetupService extends CrmBase {
  constructor(
    protected readonly databaseService: DatabaseService,
    protected readonly timeline: ActivityTimelineService,
  ) {
    super();
  }

  // ── Pipelines ──────────────────────────────────────────────────────────────────
  async pipelines(ctx: CatalogContext, includeArchived = false) {
    const { conn, scope } = await this.open(ctx);
    const where: string[] = [];
    const params: unknown[] = [];
    if (!includeArchived) where.push('p.is_active');
    const f = companyFilter(scope, 'p', 1);
    if (f) {
      params.push(f.param);
      where.push(f.sql);
    }
    const pipelines = await conn.query(
      `SELECT p.* FROM crm_pipelines p ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.is_default DESC, p.sort_order, lower(p.name)`,
      params,
    );
    if (!pipelines.length) return [];
    const stages = await conn.query(
      `SELECT s.*, (SELECT count(*)::int FROM crm_opportunities o WHERE o.stage_id = s.id AND o.is_active AND o.status = 'open') AS open_count
         FROM crm_stages s WHERE s.pipeline_id = ANY($1::uuid[]) AND s.is_active ORDER BY s.sort_order, s.created_at`,
      [pipelines.map((p: { id: string }) => p.id)],
    );
    return pipelines.map((p: { id: string }) => ({ ...p, stages: stages.filter((s: StageRow) => s.pipeline_id === p.id) }));
  }

  /** The pipeline a deal goes to when none is named: the company's default, else the shared default, else the first. */
  async resolvePipeline(conn: Queryable, scope: CompanyScope, id?: string | null) {
    if (id) {
      const [p] = await conn.query(`SELECT * FROM crm_pipelines WHERE id = $1`, [id]);
      if (!p || !isVisible(scope, p.company_id, p.branch_id)) throw new BadRequestException('That pipeline was not found');
      if (!p.is_active) throw new BadRequestException(`The ${p.name} pipeline is archived`);
      return p;
    }
    const params: unknown[] = [];
    const f = companyFilter(scope, 'p', 1);
    if (f) params.push(f.param);
    const company = defaultRecordCompany(scope);
    const rows = await conn.query(
      `SELECT p.* FROM crm_pipelines p WHERE p.is_active ${f ? `AND ${f.sql}` : ''} ORDER BY p.is_default DESC, p.sort_order LIMIT 20`, params,
    );
    const pick = rows.find((p: { is_default: boolean; company_id: string | null; branch_id?: string | null }) => p.is_default && p.company_id === company)
      ?? rows.find((p: { is_default: boolean; company_id: string | null; branch_id?: string | null }) => p.is_default && !p.company_id) ?? rows[0];
    if (!pick) throw new BadRequestException('Create a pipeline first (CRM -> Set-up)');
    return pick;
  }

  async stagesOf(conn: Queryable, pipelineId: string): Promise<StageRow[]> {
    return conn.query(`SELECT * FROM crm_stages WHERE pipeline_id = $1 AND is_active ORDER BY sort_order, created_at`, [pipelineId]);
  }

  async createPipeline(ctx: CatalogContext, dto: PipelineDto) {
    const { conn, scope } = await this.open(ctx);
    const companyId = dto.company_id !== undefined ? dto.company_id : defaultRecordCompany(scope);
    assertCompanyAssignable(scope, companyId);
    const branchId = dto.branch_id !== undefined ? dto.branch_id : defaultRecordBranch(scope);
    assertBranchAssignable(scope, branchId);
    const id = await conn
      .transaction(async (m: Queryable) => {
        if (dto.is_default) await this.clearDefault(m, companyId ?? null);
        const [p] = await m.query(
          `INSERT INTO crm_pipelines (name, is_default, company_id, sort_order, created_by, updated_by)
           VALUES ($1, $2, $3, COALESCE($4, (SELECT COALESCE(max(sort_order), 0) + 1 FROM crm_pipelines)), $5, $5) RETURNING id`,
          [dto.name.trim(), !!dto.is_default, companyId ?? null, dto.sort_order ?? null, ctx.user?.sub ?? null],
        );
        for (let i = 0; i < DEFAULT_STAGES.length; i++) {
          const s = DEFAULT_STAGES[i];
          await m.query(
            `INSERT INTO crm_stages (pipeline_id, name, probability, rotting_days, is_won, is_lost, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [p.id, s.name, s.probability, s.rotting_days, s.is_won, s.is_lost, i + 1],
          );
        }
        return p.id as string;
      })
      .catch((e: unknown) => this.rethrow(e));
    // its stages follow (trg_cascade_company_branch)
    if (branchId) await setRecordBranch(conn, 'crm_pipelines', id, branchId);
    return (await this.pipelines(ctx, true)).find((p: { id: string }) => p.id === id);
  }

  async updatePipeline(ctx: CatalogContext, id: string, dto: UpdatePipelineDto) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findPipeline(conn, scope, id);
    if (dto.company_id !== undefined) assertCompanyAssignable(scope, dto.company_id);
    assertBranchAssignable(scope, dto.branch_id);
    if (dto.is_active === false) {
      if (before.is_default) throw new BadRequestException('Make another pipeline the default before archiving this one');
      const [{ n }] = await conn.query(`SELECT count(*)::int AS n FROM crm_opportunities WHERE pipeline_id = $1 AND is_active AND status = 'open'`, [id]);
      if (n > 0) throw new BadRequestException(`${n} open deal${n === 1 ? ' is' : 's are'} in this pipeline; move or close them first`);
    }
    if (dto.is_default === false && before.is_default) throw new BadRequestException('Make another pipeline the default instead');
    const row = { ...dto, name: dto.name?.trim() };
    const set = setClause(row, ['name', 'is_default', 'company_id', 'branch_id', 'sort_order', 'is_active']);
    if (!set.present.length) return before;
    await conn
      .transaction(async (m: Queryable) => {
        if (dto.is_default) await this.clearDefault(m, (dto.company_id !== undefined ? dto.company_id : before.company_id) ?? null);
        await m.query(`UPDATE crm_pipelines SET ${set.sql}, updated_by = $${set.params.length + 1}, updated_at = now() WHERE id = $${set.params.length + 2}`,
          [...set.params, ctx.user?.sub ?? null, id]);
      })
      .catch((e: unknown) => this.rethrow(e));
    return (await this.pipelines(ctx, true)).find((p: { id: string }) => p.id === id);
  }

  // ── Stages ─────────────────────────────────────────────────────────────────────
  async addStage(ctx: CatalogContext, pipelineId: string, dto: StageDto) {
    const { conn, scope } = await this.open(ctx);
    await this.findPipeline(conn, scope, pipelineId);
    if (dto.is_won && dto.is_lost) throw new BadRequestException('A stage is won or lost, not both');
    const [row] = await conn
      .query(
        `INSERT INTO crm_stages (pipeline_id, name, probability, rotting_days, is_won, is_lost, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, (SELECT COALESCE(max(sort_order), 0) + 1 FROM crm_stages WHERE pipeline_id = $1))) RETURNING *`,
        [pipelineId, dto.name.trim(), dto.is_won ? 100 : dto.is_lost ? 0 : dto.probability ?? 0, dto.rotting_days ?? null, !!dto.is_won, !!dto.is_lost, dto.sort_order ?? null],
      )
      .catch((e: unknown) => this.rethrow(e));
    return row;
  }

  async updateStage(ctx: CatalogContext, stageId: string, dto: UpdateStageDto) {
    const { conn, scope } = await this.open(ctx);
    const stage = await this.findStage(conn, scope, stageId);
    const won = dto.is_won ?? stage.is_won;
    const lost = dto.is_lost ?? stage.is_lost;
    if (won && lost) throw new BadRequestException('A stage is won or lost, not both');
    if ((dto.is_won === false && stage.is_won) || (dto.is_lost === false && stage.is_lost)) await this.keepClosingStage(conn, stage);
    const row = { ...dto, name: dto.name?.trim() };
    const set = setClause(row, ['name', 'probability', 'rotting_days', 'is_won', 'is_lost', 'sort_order']);
    if (!set.present.length) return stage;
    const [updated] = await conn
      .query(`UPDATE crm_stages SET ${set.sql}, updated_at = now() WHERE id = $${set.params.length + 1} RETURNING *`, [...set.params, stageId])
      .catch((e: unknown) => this.rethrow(e));
    return updated;
  }

  /** Archives a stage with no open deals; a pipeline keeps at least one won and one lost stage. */
  async archiveStage(ctx: CatalogContext, stageId: string) {
    const { conn, scope } = await this.open(ctx);
    const stage = await this.findStage(conn, scope, stageId);
    const [{ n }] = await conn.query(`SELECT count(*)::int AS n FROM crm_opportunities WHERE stage_id = $1 AND is_active AND status = 'open'`, [stageId]);
    if (n > 0) throw new BadRequestException(`${n} open deal${n === 1 ? ' is' : 's are'} in ${stage.name}; move them first`);
    if (stage.is_won || stage.is_lost) await this.keepClosingStage(conn, stage);
    const open = (await this.stagesOf(conn, stage.pipeline_id)).filter((s) => !s.is_won && !s.is_lost && s.id !== stageId);
    if (!stage.is_won && !stage.is_lost && !open.length) throw new BadRequestException('A pipeline needs at least one open stage');
    await conn.query(`UPDATE crm_stages SET is_active = false, updated_at = now() WHERE id = $1`, [stageId]);
    return { ...stage, is_active: false };
  }

  async reorderStages(ctx: CatalogContext, pipelineId: string, dto: ReorderStagesDto) {
    const { conn, scope } = await this.open(ctx);
    await this.findPipeline(conn, scope, pipelineId);
    const stages = await this.stagesOf(conn, pipelineId);
    const ids = new Set(stages.map((s) => s.id));
    if (dto.stage_ids.length !== ids.size || dto.stage_ids.some((id) => !ids.has(id))) {
      throw new BadRequestException('Send every stage of the pipeline once, in the new order');
    }
    await conn.transaction(async (m: Queryable) => {
      for (let i = 0; i < dto.stage_ids.length; i++) await m.query(`UPDATE crm_stages SET sort_order = $1, updated_at = now() WHERE id = $2`, [i + 1, dto.stage_ids[i]]);
    });
    return this.stagesOf(conn, pipelineId);
  }

  // ── Lead sources and lost reasons ──────────────────────────────────────────────
  async listItems(ctx: CatalogContext, table: 'crm_lead_sources' | 'crm_lost_reasons', includeArchived = false) {
    const { conn } = await this.open(ctx);
    return conn.query(`SELECT * FROM ${table} ${includeArchived ? '' : 'WHERE is_active'} ORDER BY sort_order, lower(name)`);
  }

  async createItem(ctx: CatalogContext, table: 'crm_lead_sources' | 'crm_lost_reasons', dto: ListItemDto) {
    const { conn } = await this.open(ctx);
    const [row] = await conn
      .query(`INSERT INTO ${table} (name, sort_order) VALUES ($1, COALESCE($2, (SELECT COALESCE(max(sort_order), 0) + 1 FROM ${table}))) RETURNING *`,
        [dto.name.trim(), dto.sort_order ?? null])
      .catch((e: unknown) => this.rethrow(e));
    return row;
  }

  async updateItem(ctx: CatalogContext, table: 'crm_lead_sources' | 'crm_lost_reasons', id: string, dto: UpdateListItemDto) {
    const { conn } = await this.open(ctx);
    const [before] = await conn.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    if (!before) throw new NotFoundException('Not found');
    const set = setClause({ ...dto, name: dto.name?.trim() }, ['name', 'sort_order', 'is_active']);
    if (!set.present.length) return before;
    const [row] = await conn
      .query(`UPDATE ${table} SET ${set.sql}, updated_at = now() WHERE id = $${set.params.length + 1} RETURNING *`, [...set.params, id])
      .catch((e: unknown) => this.rethrow(e));
    return row;
  }

  // ── helpers ────────────────────────────────────────────────────────────────────
  private async clearDefault(m: Queryable, companyId: string | null) {
    await m.query(
      `UPDATE crm_pipelines SET is_default = false WHERE is_default AND COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($1::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`,
      [companyId],
    );
  }

  private async keepClosingStage(conn: Queryable, stage: StageRow) {
    const others = (await this.stagesOf(conn, stage.pipeline_id)).filter((s) => s.id !== stage.id);
    if (stage.is_won && !others.some((s) => s.is_won)) throw new BadRequestException('A pipeline needs a won stage');
    if (stage.is_lost && !others.some((s) => s.is_lost)) throw new BadRequestException('A pipeline needs a lost stage');
  }

  async findPipeline(conn: Queryable, scope: CompanyScope, id: string) {
    const [p] = await conn.query(`SELECT * FROM crm_pipelines WHERE id = $1`, [id]);
    if (!p || !isVisible(scope, p.company_id, p.branch_id)) throw new NotFoundException('Pipeline not found');
    return p;
  }

  async findStage(conn: Queryable, scope: CompanyScope, id: string): Promise<StageRow> {
    const [s] = await conn.query(`SELECT s.*, p.company_id, p.branch_id FROM crm_stages s JOIN crm_pipelines p ON p.id = s.pipeline_id WHERE s.id = $1`, [id]);
    if (!s || !isVisible(scope, s.company_id, s.branch_id) || !s.is_active) throw new NotFoundException('Stage not found');
    return s;
  }
}
