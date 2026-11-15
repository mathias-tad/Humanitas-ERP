import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * SECURITY: Strict SQL allowlist for AI-generated queries.
 *
 * The previous check (query.trim().toUpperCase().startsWith('SELECT')) was trivially
 * bypassable with CTEs, semicolon stacking, or comment injections like:
 *   SELECT 1; DROP TABLE users; --
 *   WITH x AS (DELETE FROM users) SELECT * FROM x;
 *
 * This implementation uses multi-layer defense:
 *   1. Strip SQL comments before any analysis
 *   2. Reject any statement containing semicolons (prevents stacking)
 *   3. Reject DDL/DML keywords via regex after normalization
 *   4. Reject CTEs that contain non-SELECT inner statements
 *   5. Enforce a hard row limit via LIMIT injection
 *   6. Run in a READ-ONLY transaction to block any side effects
 */

const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'CREATE',
  'ALTER',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'EXECUTE',
  'EXEC',
  'CALL',
  'COPY',
  'VACUUM',
  'ANALYZE',
  'REINDEX',
  'CLUSTER',
  'SET SESSION',
  'SET LOCAL',
  'SET ROLE',
  'SET SEARCH_PATH',
  'DO $$',
  'DO $',
  'PG_SLEEP',
  'PG_READ_FILE',
  'PG_WRITE_FILE',
  'LO_IMPORT',
  'LO_EXPORT',
  'DBLINK',
  'POSTGRES_FDW',
];

// ── Data-access policy for AI-generated SQL ────────────────────────────────
// Credentials / secrets: never readable by the AI, for anyone.
const SECRET_COLUMN_PATTERN =
  /(password|passwd|pwd_hash|refresh_token|setup_token|reset_token|access_token|api_key|apikey|key_hash|secret|otp|totp|mfa|encryption|private_key|smtp_pass)/i;
const SECRET_TABLES = ['developer_api_keys', 'api_keys', 'user_sessions', 'password_resets'];

// Compensation data: only for users who may see payroll.
const PAYROLL_PERMISSIONS = ['*', 'view_payroll', 'manage_payroll', 'edit_payroll', 'run_payroll'];
const PAYROLL_TABLES = [
  'payroll_runs', 'payroll_items', 'user_incomes', 'user_income_assignments', 'income_types',
  'income_type_category_rules', 'category_allowances', 'acting_assignments', 'tax_rules',
  'loans', 'loan_approvals', 'user_penalties', 'per_diem_claims', 'overtime_entries',
];
const PAYROLL_COLUMN_PATTERN =
  /(salary|salaries|wage|gross|net_pay|total_net|total_gross|payslip|bank_account|account_number|iban|tin\b|national_id|tax_id|pension|allowance|deduction|bonus|compensation)/i;

// Whole-row serialisation would bypass column checks (e.g. SELECT row_to_json(u) FROM users u).
const ROW_SERIALISATION_FUNCTIONS = /\b(row_to_json|to_json|to_jsonb|json_agg|jsonb_agg|json_object_agg|jsonb_object_agg|json_populate_record|jsonb_populate_record|hstore|record_out|row)\s*\(/i;

function referencedRelations(normalizedUpper: string): string[] {
  const names = new Set<string>();
  const re = /\b(?:FROM|JOIN)\s+("?[A-Z0-9_]+"?(?:\."?[A-Z0-9_]+"?)?)(?:\s+(?:AS\s+)?("?[A-Z0-9_]+"?))?/g;
  let m: RegExpExecArray | null;
  const reserved = new Set(['WHERE', 'ON', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'GROUP', 'ORDER', 'LIMIT', 'UNION', 'HAVING', 'LATERAL', 'NATURAL', 'USING', 'OFFSET', 'WINDOW', 'SELECT']);
  while ((m = re.exec(normalizedUpper))) {
    const rel = m[1].replace(/"/g, '');
    names.add(rel.includes('.') ? rel.split('.').pop()! : rel);
    if (m[2] && !reserved.has(m[2].replace(/"/g, ''))) names.add(m[2].replace(/"/g, ''));
  }
  return [...names];
}

/** Enforces the data-access policy on a validated SELECT. Returns a reason when rejected. */
function checkDataPolicy(stripped: string, canSeePayroll: boolean): string | null {
  const upper = stripped.replace(/\s+/g, ' ').toUpperCase();
  const lower = upper.toLowerCase();

  if (ROW_SERIALISATION_FUNCTIONS.test(lower)) {
    return 'Whole-row serialisation functions (row_to_json, to_json, json_agg, …) are not allowed. Select specific columns instead.';
  }

  const relations = referencedRelations(upper).map((r) => r.toLowerCase());
  // Casting or wrapping a whole row/alias (u::text, (u).*, func(u)) is also row serialisation.
  for (const rel of relations) {
    const r = rel.replace(/[^a-z0-9_]/g, '');
    if (!r) continue;
    const wholeRow = new RegExp(`(\\b${r}\\s*::)|(\\(\\s*${r}\\s*\\))|(\\b${r}\\s*\\)\\s*\\.\\s*\\*)`, 'i');
    if (wholeRow.test(lower)) {
      return 'Casting or wrapping an entire row is not allowed. Select specific columns instead.';
    }
  }

  for (const t of SECRET_TABLES) {
    if (new RegExp(`\\b${t}\\b`, 'i').test(lower)) return 'That table contains credentials and cannot be queried.';
  }
  const identifiers = lower.match(/[a-z_][a-z0-9_]*/g) || [];
  if (identifiers.some((id) => SECRET_COLUMN_PATTERN.test(id))) {
    return 'Credential and secret columns cannot be queried.';
  }

  if (!canSeePayroll) {
    for (const t of PAYROLL_TABLES) {
      if (new RegExp(`\\b${t}\\b`, 'i').test(lower)) {
        return 'Payroll and compensation data is only available to users with payroll permissions.';
      }
    }
    if (identifiers.some((id) => PAYROLL_COLUMN_PATTERN.test(id))) {
      return 'Salary and compensation fields are only available to users with payroll permissions.';
    }
  }
  return null;
}

const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const HEX_TOKEN_RE = /^[a-f0-9]{48,}$/i;
const JWT_RE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** Last line of defence: strip sensitive keys (e.g. from SELECT *) and anything that looks like a credential. */
function redactRows(value: any, canSeePayroll: boolean): any {
  if (Array.isArray(value)) return value.map((v) => redactRows(v, canSeePayroll));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_COLUMN_PATTERN.test(k)) continue;
      if (!canSeePayroll && PAYROLL_COLUMN_PATTERN.test(k)) continue;
      out[k] = redactRows(v, canSeePayroll);
    }
    return out;
  }
  if (typeof value === 'string' && (BCRYPT_RE.test(value) || HEX_TOKEN_RE.test(value) || JWT_RE.test(value))) {
    return '[REDACTED]';
  }
  return value;
}

const MAX_RESULT_CHARS = 5000;
const MAX_ROWS = 100;

function stripSqlComments(sql: string): string {
  // Remove -- line comments
  let result = sql.replace(/--[^\r\n]*/g, ' ');
  // Remove /* block comments */ (non-greedy)
  result = result.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return result;
}

function validateSelectOnly(rawQuery: string): { valid: boolean; reason?: string; sanitized?: string } {
  // Step 1: strip comments first so they can't hide forbidden keywords
  const stripped = stripSqlComments(rawQuery).trim();

  // Step 2: reject semicolons entirely — prevents statement stacking
  if (stripped.includes(';')) {
    return { valid: false, reason: 'Semicolons are not permitted. Only a single SELECT statement is allowed.' };
  }

  // Step 3: normalize whitespace and uppercase for keyword matching
  const normalized = stripped.replace(/\s+/g, ' ').toUpperCase();

  // Step 4: must start with SELECT or WITH (CTE)
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH ')) {
    return { valid: false, reason: 'Only SELECT queries are permitted.' };
  }

  // Step 5: check for forbidden DDL/DML keywords anywhere in the normalized query
  for (const keyword of FORBIDDEN_KEYWORDS) {
    // Use word-boundary-like check: keyword surrounded by non-alpha chars
    const pattern = new RegExp(`(?<![A-Z_])(${keyword.replace(/\s+/g, '\\s+')})(?![A-Z_])`, 'i');
    if (pattern.test(normalized)) {
      return { valid: false, reason: `Forbidden SQL keyword detected: ${keyword}` };
    }
  }

  // Step 6: if it's a CTE (WITH ...), ensure the inner body is still SELECT-only
  if (normalized.startsWith('WITH ')) {
    // Find the final SELECT after closing paren of CTE definitions
    // Simple heuristic: after all CTE definitions, there must be a SELECT
    const lastSelectIdx = normalized.lastIndexOf('SELECT');
    if (lastSelectIdx === -1) {
      return { valid: false, reason: 'CTE (WITH clause) must end with a SELECT statement.' };
    }
  }

  // Step 7: inject LIMIT to prevent large data exfiltration if not present
  let sanitized = stripped;
  if (!normalized.includes('LIMIT')) {
    sanitized = `${stripped} LIMIT ${MAX_ROWS}`;
  } else {
    // Enforce max LIMIT — replace any LIMIT N where N > MAX_ROWS
    sanitized = stripped.replace(
      /LIMIT\s+(\d+)/gi,
      (_, n) => `LIMIT ${Math.min(parseInt(n, 10), MAX_ROWS)}`,
    );
  }

  return { valid: true, sanitized };
}

@Injectable()
export class AiDbQueryService {
  private readonly logger = new Logger(AiDbQueryService.name);

  constructor(private databaseService: DatabaseService) {}

  /**
   * @param tenantSlug       tenant whose database is queried
   * @param userPermissions  the caller's RBAC permission keys (['*'] for owner/admin)
   */
  getDbTool(tenantSlug: string, userPermissions: string[] | string = []) {
    const perms = Array.isArray(userPermissions) ? userPermissions : [userPermissions];
    const canSeePayroll = perms.some((p) => PAYROLL_PERMISSIONS.includes(p));
    return tool(
      async ({ query }) => {
        try {
          this.logger.log(`[AI-DB-QUERY] Tenant: ${tenantSlug} — raw query received (${query.length} chars)`);

          // ── SECURITY: Multi-layer SQL validation ──────────────────────────
          const validation = validateSelectOnly(query);
          if (!validation.valid) {
            this.logger.warn(
              `[AI-DB-QUERY] Rejected query for tenant ${tenantSlug}: ${validation.reason}`,
            );
            return `Security Error: ${validation.reason} Only read-only SELECT queries are permitted.`;
          }
          const safeQuery = validation.sanitized!;

          // ── SECURITY: column/table data-access policy ─────────────────────
          const policyViolation = checkDataPolicy(stripSqlComments(safeQuery), canSeePayroll);
          if (policyViolation) {
            this.logger.warn(`[AI-DB-QUERY] Policy rejection for tenant ${tenantSlug}: ${policyViolation}`);
            return `Access Denied: ${policyViolation}`;
          }
          // ─────────────────────────────────────────────────────────────────

          // Look up tenant database by slug
          const rows = await (this.databaseService as any).masterDataSource.query(
            `SELECT database_name FROM tenants WHERE slug = $1`,
            [tenantSlug],
          );
          if (!rows || !rows.length) {
            return `Error: Tenant "${tenantSlug}" not found in master database.`;
          }

          const dataSource = await this.databaseService.getTenantConnection(rows[0].database_name);

          // ── SECURITY: Execute inside a READ-ONLY transaction ───────────────
          let results: any;
          const queryRunner = dataSource.createQueryRunner();
          await queryRunner.connect();
          try {
            await queryRunner.startTransaction('SERIALIZABLE');
            await queryRunner.query('SET TRANSACTION READ ONLY');
            results = await queryRunner.query(safeQuery);
            await queryRunner.commitTransaction();
          } catch (txErr) {
            await queryRunner.rollbackTransaction();
            throw txErr;
          } finally {
            await queryRunner.release();
          }
          // ─────────────────────────────────────────────────────────────────

          const jsonString = JSON.stringify(redactRows(results, canSeePayroll));
          if (jsonString.length > MAX_RESULT_CHARS) {
            return (
              jsonString.substring(0, MAX_RESULT_CHARS) +
              '... (results truncated for length. Please refine your query to return fewer columns or add a more specific WHERE clause)'
            );
          }
          return jsonString;
        } catch (error) {
          this.logger.error(
            `[AI-DB-QUERY] Query execution error for tenant ${tenantSlug}:`,
            error?.message,
          );
          return `Query failed: ${error.message}. Remember to query information_schema.tables or information_schema.columns if you are unsure of the schema.`;
        }
      },
      {
        name: 'query_tenant_database',
        description:
          'Use this tool to execute a READ-ONLY SQL SELECT query on the PostgreSQL database to get factual data. ' +
          'You can query information_schema.tables and information_schema.columns first if you do not know the exact table structure. ' +
          'ONLY SELECT queries are allowed. No INSERT, UPDATE, DELETE, DROP, or DDL. Results are capped at 100 rows.',
        schema: z.object({
          query: z.string().describe('The SELECT SQL query to execute. Must be a pure SELECT with no semicolons.'),
        }),
      },
    );
  }
}
