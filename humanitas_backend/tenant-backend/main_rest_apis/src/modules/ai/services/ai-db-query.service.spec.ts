import { Test, TestingModule } from '@nestjs/testing';
import { AiDbQueryService } from './ai-db-query.service';
import { DatabaseService } from '../../database/database.service';

describe('AiDbQueryService SQL Injection Defense', () => {
  let service: AiDbQueryService;
  let mockDatabaseService: any;
  let mockQueryRunner: any;

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([{ count: 42 }]),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };

    mockDatabaseService = {
      masterDataSource: {
        query: jest.fn().mockResolvedValue([{ database_name: 'tenant_db_test' }]),
      },
      getTenantConnection: jest.fn().mockResolvedValue({
        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiDbQueryService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<AiDbQueryService>(AiDbQueryService);
  });

  it('should allow benign SELECT query and wrap in read-only transaction', async () => {
    const dbTool = service.getDbTool('test-tenant', '*');
    const result = await dbTool.invoke({ query: 'SELECT id, email FROM users' });

    expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.query).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(result).toContain('count');
  });

  it('should block stacked statements with semicolons (e.g. DROP TABLE)', async () => {
    const dbTool = service.getDbTool('test-tenant', '*');
    const result = await dbTool.invoke({
      query: 'SELECT 1; DROP TABLE users; --',
    });

    expect(result).toContain('Security Error');
    expect(mockQueryRunner.connect).not.toHaveBeenCalled();
  });

  it('should block DDL/DML keywords like DELETE, INSERT, UPDATE, DROP, TRUNCATE', async () => {
    const dbTool = service.getDbTool('test-tenant', '*');

    const dropRes = await dbTool.invoke({ query: 'DROP TABLE users' });
    expect(dropRes).toContain('Security Error');

    const deleteRes = await dbTool.invoke({ query: 'DELETE FROM users WHERE id = 1' });
    expect(deleteRes).toContain('Security Error');

    const updateRes = await dbTool.invoke({ query: 'UPDATE users SET is_active = false' });
    expect(updateRes).toContain('Security Error');

    const insertRes = await dbTool.invoke({ query: 'INSERT INTO users (id) VALUES (1)' });
    expect(insertRes).toContain('Security Error');
  });

  it('should block SQL comment-masked attacks', async () => {
    const dbTool = service.getDbTool('test-tenant', '*');
    const commentAttack = await dbTool.invoke({
      query: 'SELECT /*!32302 1/0, */ 1; DROP TABLE users',
    });

    expect(commentAttack).toContain('Security Error');
    expect(mockQueryRunner.connect).not.toHaveBeenCalled();
  });
});
