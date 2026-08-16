import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

@Injectable()
export class AiDbQueryService {
  constructor(private databaseService: DatabaseService) {}

  getDbTool(tenantSlug: string, userPermissions: string) {
    return tool(
      async ({ query }) => {
        try {
          console.log(`[AI-TOOL-CALL] query_tenant_database called by ${tenantSlug}. Query:`, query);
          if (!query.trim().toUpperCase().startsWith('SELECT')) {
            return 'Error: Only SELECT queries are permitted for security reasons.';
          }

          // Look up by slug (not UUID) since we receive tenantSlug from JWT context
          const rows = await (this.databaseService as any).masterDataSource.query(
            `SELECT database_name FROM tenants WHERE slug = $1`,
            [tenantSlug],
          );
          if (!rows || !rows.length) {
            return `Error: Tenant "${tenantSlug}" not found in master database.`;
          }
          const dataSource = await this.databaseService.getTenantConnection(rows[0].database_name);
          const results = await dataSource.query(query);
          
          // Truncate results if they are too massive to avoid token limit errors
          const jsonString = JSON.stringify(results);
          if (jsonString.length > 5000) {
            return jsonString.substring(0, 5000) + '... (results truncated for length. Please refine your query)';
          }
          return jsonString;
        } catch (error) {
          console.error(`AI DB Query Error for ${tenantSlug} (Query: ${query}):`, error);
          return `Query failed: ${error.message}. Remember to query information_schema.tables or information_schema.columns if you are unsure of the schema.`;
        }
      },
      {
        name: 'query_tenant_database',
        description: 'Use this tool to execute a READ-ONLY SQL SELECT query on the PostgreSQL database to get factual data. You can query information_schema.tables and information_schema.columns first if you do not know the exact table structure. ONLY use SELECT.',
        schema: z.object({
          query: z.string().describe('The SELECT SQL query to execute'),
        }),
      }
    );
  }
}
