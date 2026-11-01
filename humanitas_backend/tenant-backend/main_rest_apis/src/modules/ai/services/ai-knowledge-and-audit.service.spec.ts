import { Test, TestingModule } from '@nestjs/testing';
import { AiActionService } from './ai-action.service';
import { AgentToolRouterService } from './agent-tool-router.service';
import { AiService } from '../ai.service';
import { DatabaseService } from '../../database/database.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Tenant } from '../../auth/entities/tenant.entity';
import { RoleContextBuilderService } from './role-context-builder.service';
import { AiDbQueryService } from './ai-db-query.service';
import { AiConversationService } from './ai-conversation.service';
import { AiUsageService } from './ai-usage.service';
import { AiSettingsFetchService } from './ai-settings-fetch.service';
import { AiAnalyticsService } from './ai-analytics.service';
import { AiFileParserService } from './ai-file-parser.service';

describe('AI Knowledge Base & Execution Audit Trail', () => {
  let actionService: AiActionService;
  let toolRouterService: AgentToolRouterService;
  let aiService: AiService;
  let mockTenantDs: any;
  let mockMasterDs: any;

  beforeEach(async () => {
    mockTenantDs = {
      query: jest.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('system_audit_logs')) {
          if (sql.includes('INSERT INTO system_audit_logs')) {
            return Promise.resolve([]);
          }
          if (sql.includes('SELECT') && sql.includes('ai_on_behalf')) {
            return Promise.resolve([
              {
                id: 'audit-1',
                action_type: 'ai_action',
                performed_by: 'user-uuid-1',
                executed_by: 'ai_on_behalf',
                entity_type: 'leave_request',
                entity_id: 'leave-123',
                details: { status: 'Approved' },
                created_at: new Date('2026-11-01T12:00:00Z'),
                user_name: 'John Doe',
              },
            ]);
          }
        }
        if (sql.includes('ai_knowledge_entries')) {
          if (sql.includes('INSERT INTO ai_knowledge_entries')) {
            return Promise.resolve([
              {
                id: 'k-1',
                module_key: 'leave',
                feature_name: 'Leave Management',
                route_path: '/leave/requests',
                mobile_screen_name: 'LeaveRequestsScreen',
              },
            ]);
          }
          return Promise.resolve([
            {
              module_key: 'hrms_workforce',
              feature_name: 'Workforce Directory',
              route_path: '/accounts',
              mobile_screen_name: 'EmployeeListScreen',
              mobile_nav_path: 'Bottom Bar -> Profile -> Directory',
              platform: 'both',
              page_purpose: 'Manage employee accounts and profiles.',
              available_actions: ['add_employee', 'edit_employee'],
              button_locations: [{ label: 'Add Employee', location: 'Top right' }],
              required_permissions: ['view_users', 'create_users'],
              step_by_step_instructions: {
                web: ['Go to Accounts (/accounts).', 'Click Add Employee.'],
                mobile: ['Open Profile tab.', 'Tap Directory.'],
              },
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };

    mockMasterDs = {
      query: jest.fn().mockResolvedValue([{ id: 'tenant-1', database_name: 'tenant_db_test' }]),
    };

    const mockDatabaseService = {
      masterDataSource: mockMasterDs,
      getTenantConnection: jest.fn().mockResolvedValue(mockTenantDs),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiActionService,
        AgentToolRouterService,
        AiService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: getRepositoryToken(Tenant), useValue: {} },
        { provide: RoleContextBuilderService, useValue: {} },
        { provide: AiDbQueryService, useValue: {} },
        { provide: AiConversationService, useValue: {} },
        { provide: AiUsageService, useValue: {} },
        { provide: AiSettingsFetchService, useValue: {} },
        { provide: AiAnalyticsService, useValue: {} },
        { provide: AiFileParserService, useValue: {} },
      ],
    }).compile();

    actionService = module.get<AiActionService>(AiActionService);
    toolRouterService = module.get<AgentToolRouterService>(AgentToolRouterService);
    aiService = module.get<AiService>(AiService);
  });

  describe('Audit Trail: logAuditAction & get_ai_audit_logs', () => {
    it('should log AI-executed actions with executed_by = ai_on_behalf', async () => {
      await (actionService as any).logAuditAction(
        mockTenantDs,
        'user-uuid-1',
        'leave_request',
        'leave-123',
        { status: 'Approved' },
      );

      expect(mockTenantDs.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO system_audit_logs'),
        ['user-uuid-1', 'leave_request', 'leave-123', JSON.stringify({ status: 'Approved' })],
      );
    });

    it('should retrieve AI audit logs via get_ai_audit_logs tool for permitted users', async () => {
      const tools = actionService.getActionTools('tenant-test', 'user-uuid-1', ['view_logs']);
      const auditTool = tools.find((t: any) => t.name === 'get_ai_audit_logs');
      expect(auditTool).toBeDefined();

      const result = await (auditTool as any).invoke({ limit: 5 });
      expect(result).toContain('AI-Executed Actions');
      expect(result).toContain('leave_request');
      expect(result).toContain('AI on behalf');
    });
  });

  describe('Dynamic System Guide Tool: lookup_system_guide', () => {
    it('should query ai_knowledge_entries and return instructions for both Web and Mobile', async () => {
      const tools = toolRouterService.getTools('tenant-test', '*');
      const guideTool = tools.find((t: any) => t.name === 'lookup_system_guide');
      expect(guideTool).toBeDefined();

      const result = await (guideTool as any).invoke({ query: 'employee' });
      expect(result).toContain('Workforce Directory');
      expect(result).toContain('/accounts');
      expect(result).toContain('EmployeeListScreen');
      expect(result).toContain('Add Employee');
      expect(result).toContain('Web Step-by-Step Instructions');
      expect(result).toContain('Mobile Step-by-Step Instructions');
    });
  });

  describe('AiService Knowledge Management Endpoints', () => {
    it('should query knowledge entries via getKnowledgeEntries', async () => {
      const entries = await aiService.getKnowledgeEntries('tenant-test', 'workforce', 'hrms_workforce');
      expect(entries).toBeDefined();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].feature_name).toBe('Workforce Directory');
    });

    it('should upsert knowledge entry via upsertKnowledgeEntry', async () => {
      const res = await aiService.upsertKnowledgeEntry('tenant-test', {
        module_key: 'leave',
        feature_name: 'Leave Management',
        route_path: '/leave/requests',
        mobile_screen_name: 'LeaveRequestsScreen',
        page_purpose: 'Manage employee leaves.',
      });

      expect(res).toBeDefined();
      expect(res.feature_name).toBe('Leave Management');
      expect(mockTenantDs.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ai_knowledge_entries'),
        expect.any(Array),
      );
    });
  });
});
