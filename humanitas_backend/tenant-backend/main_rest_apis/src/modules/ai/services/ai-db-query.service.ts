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

  getDbTool(tenantSlug: string, userPermissions: string) {
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

          const jsonString = JSON.stringify(results);
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
