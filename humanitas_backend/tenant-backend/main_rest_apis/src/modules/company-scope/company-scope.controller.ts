import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Put, Request, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { DatabaseService } from '../database/database.service';
import { CompanyScopeService } from './company-scope.service';
import { ScopeViolation, canUseBranch, canUseCompany, type UserScope } from './company-scope';

export class CompanyAccessItemDto {
  @IsUUID() company_id: string;
  @IsOptional() @IsBoolean() all_branches?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUUID('all', { each: true }) branch_ids?: string[];
  @IsOptional() @IsBoolean() is_default?: boolean;
}

export class SetCompanyAccessDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => CompanyAccessItemDto)
  companies: CompanyAccessItemDto[];
}

interface CompanyRow { id: string; name: string; is_default: boolean | null }
interface BranchRow { id: string; name: string; company_id: string | null; is_default: boolean | null }

/** The signed-in user's companies and branches (for the switcher and forms), and admin editing of a user's access. */
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompanyScopeController {
  constructor(
    private readonly scopes: CompanyScopeService,
    private readonly databaseService: DatabaseService,
  ) {}

  /** What the switcher and every company/branch field may offer this user. */
  @Get('me/company-scope')
  async mine(@Request() req: AuthenticatedRequest) {
    const scope = await this.scopes.forUser(req.user.tenantId, req.user.sub, req.user.role);
    const conn = await this.databaseService.getTenantConnectionById(req.user.tenantId);
    const companies: CompanyRow[] = await conn.query(
      `SELECT id, name, is_default FROM companies WHERE COALESCE(is_active, true) ORDER BY is_default DESC NULLS LAST, lower(name)`,
    );
    const branches: BranchRow[] = await conn.query(
      `SELECT id, name, company_id, is_default FROM branches WHERE COALESCE(is_active, true) ORDER BY is_default DESC NULLS LAST, lower(name)`,
    );
    return CompanyScopeController.describe(scope, companies, branches);
  }

  static describe(scope: UserScope, companies: CompanyRow[], branches: BranchRow[]) {
    const list = companies
      .filter((c) => canUseCompany(scope, c.id))
      .map((c) => {
        const access = scope.companies?.find((a) => a.companyId === c.id);
        const own = branches.filter((b) => b.company_id === c.id && canUseBranch(scope, b.id, c.id));
        return {
          id: c.id,
          name: c.name,
          is_default: c.id === scope.defaultCompanyId,
          all_branches: scope.allBranches || !access || access.branchIds === null,
          branches: own.map((b) => ({ id: b.id, name: b.name, is_default: b.id === scope.defaultBranchId || (!scope.defaultBranchId && !!b.is_default) })),
        };
      });
    return {
      all_companies: scope.allCompanies,
      all_branches: scope.allBranches,
      default_company_id: scope.defaultCompanyId ?? list.find((c) => c.is_default)?.id ?? list[0]?.id ?? null,
      default_branch_id: scope.defaultBranchId,
      companies: list,
    };
  }

  @Get('users/:id/company-access')
  @RequirePermissions('view_users')
  async get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    const conn = await this.databaseService.getTenantConnectionById(req.user.tenantId);
    const target = await CompanyScopeService.load(conn, id, await this.roleName(conn, id));
    return {
      all_companies: target.allCompanies,
      all_branches: target.allBranches,
      companies: (target.companies ?? []).map((c) => ({
        company_id: c.companyId,
        all_branches: c.branchIds === null,
        branch_ids: c.branchIds ?? [],
        is_default: c.isDefault,
      })),
    };
  }

  /** Replaces the user's company access with the given list (only companies the editor can see are changed). */
  @Put('users/:id/company-access')
  @RequirePermissions('edit_users')
  async set(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetCompanyAccessDto) {
    const editor = await this.scopes.forUser(req.user.tenantId, req.user.sub, req.user.role);
    const conn = await this.databaseService.getTenantConnectionById(req.user.tenantId);
    const [exists] = await conn.query(`SELECT id FROM users WHERE id = $1`, [id]);
    if (!exists) throw new BadRequestException('User not found');
    const ids = dto.companies.map((c) => c.company_id);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each company can be listed once');
    if (dto.companies.filter((c) => c.is_default).length > 1) throw new BadRequestException('Only one company can be the default');
    const branchIds = dto.companies.flatMap((c) => (c.all_branches === false ? (c.branch_ids ?? []) : []));
    const branches: { id: string; company_id: string | null }[] = branchIds.length
      ? await conn.query(`SELECT id, company_id FROM branches WHERE id = ANY($1::uuid[])`, [branchIds])
      : [];
    const companies: { id: string }[] = ids.length ? await conn.query(`SELECT id FROM companies WHERE id = ANY($1::uuid[])`, [ids]) : [];
    for (const c of dto.companies) {
      if (!companies.some((x) => x.id === c.company_id)) throw new BadRequestException('Company not found');
      if (!canUseCompany(editor, c.company_id)) throw new ForbiddenException('You can only give access to companies you have access to');
      if (c.all_branches === false) {
        if (!c.branch_ids?.length) throw new BadRequestException('Choose at least one branch, or allow all branches');
        for (const b of c.branch_ids) {
          const row = branches.find((x) => x.id === b);
          if (!row || row.company_id !== c.company_id) throw new BadRequestException('A chosen branch belongs to another company');
          if (!canUseBranch(editor, b, c.company_id)) throw new ForbiddenException('You can only give access to branches you have access to');
        }
      } else if (!editor.allBranches) {
        throw new ForbiddenException('Only users with access to every branch can give access to all branches');
      }
    }
    const list = dto.companies.map((c, i) => ({ ...c, is_default: dto.companies.some((x) => x.is_default) ? !!c.is_default : i === 0 }));
    const visible = editor.allCompanies ? null : (editor.companies ?? []).map((c) => c.companyId);
    try {
      await conn.transaction(async (m: { query: (sql: string, p?: unknown[]) => Promise<unknown> }) => {
        // Rows for companies the editor cannot see stay as they are.
        await m.query(
          visible === null
            ? `DELETE FROM user_company_access WHERE user_id = $1`
            : `DELETE FROM user_company_access WHERE user_id = $1 AND company_id = ANY($2::uuid[])`,
          visible === null ? [id] : [id, visible],
        );
        if (list.some((c) => c.is_default)) await m.query(`UPDATE user_company_access SET is_default = false WHERE user_id = $1`, [id]);
        for (const c of list) {
          await m.query(
            `INSERT INTO user_company_access (user_id, company_id, all_branches, branch_ids, is_default, created_by)
             VALUES ($1, $2, $3, $4::uuid[], $5, $6)`,
            [id, c.company_id, c.all_branches !== false, c.all_branches === false ? c.branch_ids : [], c.is_default, req.user.sub],
          );
        }
        // Keep the user's own company/branch (used by older screens and record defaults) in step.
        const def = list.find((c) => c.is_default);
        if (def) {
          await m.query(
            `UPDATE users SET company_id = $2,
                    branch_id = CASE WHEN $3::uuid IS NOT NULL THEN $3::uuid
                                     WHEN branch_id IS NOT NULL AND EXISTS (SELECT 1 FROM branches b WHERE b.id = users.branch_id AND b.company_id = $2) THEN branch_id
                                     ELSE NULL END,
                    updated_at = now()
              WHERE id = $1`,
            [id, def.company_id, def.all_branches === false ? def.branch_ids![0] : null],
          );
        }
      });
    } catch (err) {
      if (err instanceof ScopeViolation) throw new ForbiddenException(err.message);
      throw err;
    }
    this.scopes.invalidate(req.user.tenantId, id);
    return this.get(req, id);
  }

  private async roleName(conn: { query: (s: string, p?: unknown[]) => Promise<{ name?: string }[]> }, userId: string): Promise<string | undefined> {
    const [r] = await conn.query(`SELECT lower(r.name) AS name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [userId]);
    const name = r?.name;
    return name === 'owner' || name === 'admin' || name === 'administrator' ? (name === 'administrator' ? 'admin' : name) : name;
  }
}
