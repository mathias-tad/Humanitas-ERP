import { Test, TestingModule } from '@nestjs/testing';
import { HrmsAssetsService } from './hrms-assets.service';
import { DatabaseService } from '../database/database.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssetStatus, AssetCondition } from './dto/hrms-assets.dto';

describe('HrmsAssetsService', () => {
  let service: HrmsAssetsService;
  let mockConnection: any;
  let mockDatabaseService: any;

  beforeEach(async () => {
    mockConnection = {
      query: jest.fn(),
    };

    mockDatabaseService = {
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HrmsAssetsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<HrmsAssetsService>(HrmsAssetsService);
    // Mark tables ensured
    (service as any).ensuredTenants.add('test-tenant');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCategories and createCategory', () => {
    it('should return all asset categories', async () => {
      const mockCats = [{ id: 'cat-1', name: 'IT Equipment' }];
      mockConnection.query.mockResolvedValueOnce(mockCats);

      const result = await service.getCategories('test-tenant');
      expect(result).toEqual(mockCats);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM asset_categories')
      );
    });

    it('should create an asset category', async () => {
      mockConnection.query
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([{ id: 'new-id', name: 'Vehicles', code: 'VEH' }]);

      const result = await service.createCategory('test-tenant', {
        name: 'Vehicles',
        code: 'VEH',
        description: 'Company vehicles',
      });

      expect(result.name).toBe('Vehicles');
    });
  });

  describe('createAsset and getAssets', () => {
    it('should create an asset and generate unique tag', async () => {
      mockConnection.query
        .mockResolvedValueOnce({ affectedRows: 1 }) // insert
        .mockResolvedValueOnce([{ id: 'a1', name: 'MacBook Pro', asset_tag: 'AST-2026-001' }]) // getAssetById asset
        .mockResolvedValueOnce([]) // assignments
        .mockResolvedValueOnce([]); // maintenance

      const result = await service.createAsset(
        'test-tenant',
        {
          name: 'MacBook Pro',
          category_id: 'cat-1',
          purchase_cost: 2500,
          condition: AssetCondition.NEW,
        },
        'user-1'
      );

      expect(result.id).toBe('a1');
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO company_assets'),
        expect.any(Array)
      );
    });

    it('should filter assets by search and category', async () => {
      mockConnection.query.mockResolvedValueOnce([{ id: 'a1', name: 'Dell XPS' }]);

      const result = await service.getAssets('test-tenant', {
        category_id: 'cat-1',
        search: 'Dell',
        status: 'available',
      });

      expect(result).toHaveLength(1);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE 1=1'),
        expect.arrayContaining(['cat-1', 'available', '%Dell%', '%Dell%', '%Dell%', '%Dell%'])
      );
    });
  });

  describe('assignAsset and returnAsset', () => {
    it('should throw BadRequestException if asset is already assigned', async () => {
      mockConnection.query.mockResolvedValueOnce([
        { id: 'a1', status: AssetStatus.ASSIGNED },
      ]);

      await expect(
        service.assignAsset('test-tenant', 'a1', { user_id: 'u-1' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should assign available asset to user', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'a1', status: AssetStatus.AVAILABLE }]) // select asset
        .mockResolvedValueOnce({ affectedRows: 0 }) // deactivate previous
        .mockResolvedValueOnce({ affectedRows: 1 }) // insert assignment
        .mockResolvedValueOnce({ affectedRows: 1 }) // update asset status
        .mockResolvedValueOnce([{ id: 'a1', status: AssetStatus.ASSIGNED }]) // getAssetById asset
        .mockResolvedValueOnce([]) // assignments
        .mockResolvedValueOnce([]); // maintenance

      const result = await service.assignAsset(
        'test-tenant',
        'a1',
        { user_id: 'u-1', notes: 'Deploy laptop' },
        'admin-1'
      );

      expect(result.status).toBe(AssetStatus.ASSIGNED);
    });

    it('should return asset and update condition', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'a1', status: AssetStatus.ASSIGNED }]) // select asset
        .mockResolvedValueOnce({ affectedRows: 1 }) // update assignment
        .mockResolvedValueOnce({ affectedRows: 1 }) // update asset status
        .mockResolvedValueOnce([{ id: 'a1', status: AssetStatus.AVAILABLE, current_condition: 'good' }]) // getAssetById asset
        .mockResolvedValueOnce([]) // assignments
        .mockResolvedValueOnce([]); // maintenance

      const result = await service.returnAsset('test-tenant', 'a1', {
        return_condition: AssetCondition.GOOD,
        notes: 'Returned in good condition',
      });

      expect(result.current_condition).toBe('good');
    });
  });

  describe('getMyAssets and acknowledgeAsset', () => {
    it('should retrieve assigned assets for current user', async () => {
      mockConnection.query.mockResolvedValueOnce([
        { id: 'a1', name: 'ThinkPad', assignment_id: 'as-1' },
      ]);

      const result = await service.getMyAssets('test-tenant', 'user-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('ThinkPad');
    });

    it('should acknowledge asset custody', async () => {
      mockConnection.query.mockResolvedValueOnce({ affectedRows: 1 });

      const result = await service.acknowledgeAsset('test-tenant', 'as-1', 'user-1');
      expect(result.success).toBe(true);
      expect(result.acknowledged_at).toBeDefined();
    });
  });

  describe('Maintenance and Analytics', () => {
    it('should create maintenance log for asset', async () => {
      mockConnection.query
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([{ id: 'm-1', title: 'Battery replacement' }]);

      const result = await service.createMaintenanceLog('test-tenant', 'a1', {
        title: 'Battery replacement',
        cost: 120,
      });

      expect(result.title).toBe('Battery replacement');
    });

    it('should return asset analytics metrics', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          {
            total_assets: '10',
            available_count: '4',
            assigned_count: '5',
            maintenance_count: '1',
            retired_count: '0',
            total_valuation: '15000.00',
          },
        ])
        .mockResolvedValueOnce([{ category_name: 'IT Equipment', asset_count: 8, total_cost: 12000 }])
        .mockResolvedValueOnce([{ current_condition: 'good', count: 9 }]);

      const result = await service.getAssetAnalytics('test-tenant');
      expect(result.total_assets).toBe(10);
      expect(result.assigned_count).toBe(5);
      expect(result.total_valuation).toBe(15000);
      expect(result.category_breakdown).toHaveLength(1);
    });
  });
});
