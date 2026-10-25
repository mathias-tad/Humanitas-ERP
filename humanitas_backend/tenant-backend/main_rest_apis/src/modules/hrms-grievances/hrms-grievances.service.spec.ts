import { Test, TestingModule } from '@nestjs/testing';
import { HrmsGrievancesService } from './hrms-grievances.service';
import { DatabaseService } from '../database/database.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  GrievanceCategory,
  GrievancePriority,
  GrievanceStatus,
} from './dto/hrms-grievances.dto';

describe('HrmsGrievancesService', () => {
  let service: HrmsGrievancesService;
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
        HrmsGrievancesService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<HrmsGrievancesService>(HrmsGrievancesService);
    (service as any).ensuredTenants.add('tenant-1');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fileGrievance', () => {
    it('should file a grievance and record timeline entry', async () => {
      const mockCreated = {
        id: 'grv-1',
        ticket_number: 'GRV-202610-1234',
        user_id: 'user-1',
        category: GrievanceCategory.HARASSMENT,
        subject: 'Hostile conduct',
        description: 'Detailed description of conduct',
        status: GrievanceStatus.FILED,
      };

      mockConnection.query
        .mockResolvedValueOnce([mockCreated]) // insert grievance
        .mockResolvedValueOnce([]); // insert timeline

      const result = await service.fileGrievance('tenant-1', 'user-1', {
        category: GrievanceCategory.HARASSMENT,
        subject: 'Hostile conduct',
        description: 'Detailed description of conduct',
        priority: GrievancePriority.HIGH,
      });

      expect(result).toEqual(mockCreated);
      expect(mockConnection.query).toHaveBeenCalledTimes(2);
    });

    it('should file grievance with attachments', async () => {
      const mockCreated = { id: 'grv-2', ticket_number: 'GRV-202610-5678' };
      mockConnection.query
        .mockResolvedValueOnce([mockCreated])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // insert attachment

      const result = await service.fileGrievance('tenant-1', 'user-1', {
        category: GrievanceCategory.SAFETY,
        subject: 'Broken fire exit',
        description: 'The fire door is bolted shut',
        attachments: [
          { file_name: 'photo.jpg', file_url: 'https://example.com/photo.jpg' },
        ],
      });

      expect(result).toEqual(mockCreated);
      expect(mockConnection.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('getGrievances', () => {
    it('should filter by user_id if hasManagePerm is false', async () => {
      const mockList = [{ id: 'grv-1', subject: 'My grievance' }];
      mockConnection.query.mockResolvedValue(mockList);

      const result = await service.getGrievances('tenant-1', 'user-1', false);
      expect(result).toEqual(mockList);

      const queryArg = mockConnection.query.mock.calls[0][0];
      expect(queryArg).toContain('g.user_id = $1');
    });

    it('should show all grievances if hasManagePerm is true', async () => {
      const mockList = [
        { id: 'grv-1', subject: 'Case 1' },
        { id: 'grv-2', subject: 'Case 2' },
      ];
      mockConnection.query.mockResolvedValue(mockList);

      const result = await service.getGrievances('tenant-1', 'admin-1', true, {
        status: 'investigating',
      });
      expect(result).toEqual(mockList);

      const queryArg = mockConnection.query.mock.calls[0][0];
      expect(queryArg).not.toContain('g.user_id = $1');
      expect(queryArg).toContain('g.status = $3');
    });
  });

  describe('getGrievanceById', () => {
    it('should throw NotFoundException if grievance does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([]);

      await expect(
        service.getGrievanceById('tenant-1', 'non-existent', 'user-1', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if regular employee accesses someone else grievance', async () => {
      mockConnection.query.mockResolvedValueOnce([
        { id: 'grv-1', user_id: 'other-user' },
      ]);

      await expect(
        service.getGrievanceById('tenant-1', 'grv-1', 'user-1', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return grievance with timeline and attachments', async () => {
      const mockGrievance = { id: 'grv-1', user_id: 'user-1', subject: 'Workplace issue' };
      const mockTimeline = [{ id: 'tl-1', action: 'filed' }];
      const mockAttachments = [{ id: 'att-1', file_name: 'doc.pdf' }];

      mockConnection.query
        .mockResolvedValueOnce([mockGrievance])
        .mockResolvedValueOnce(mockTimeline)
        .mockResolvedValueOnce(mockAttachments);

      const result = await service.getGrievanceById('tenant-1', 'grv-1', 'user-1', false);
      expect(result.id).toBe('grv-1');
      expect(result.timeline).toEqual(mockTimeline);
      expect(result.attachments).toEqual(mockAttachments);
    });
  });

  describe('updateStatus', () => {
    it('should throw NotFoundException if grievance does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([]);

      await expect(
        service.updateStatus('tenant-1', 'missing', 'user-1', {
          status: GrievanceStatus.ACKNOWLEDGED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update status and record timeline entry', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'grv-1', status: 'filed' }])
        .mockResolvedValueOnce([{ id: 'grv-1', status: 'investigating' }])
        .mockResolvedValueOnce([]);

      const result = await service.updateStatus('tenant-1', 'grv-1', 'admin-1', {
        status: GrievanceStatus.INVESTIGATING,
        notes: 'Commenced witness interviews',
      });

      expect(result.status).toBe('investigating');
    });
  });

  describe('assignInvestigator', () => {
    it('should assign investigator and transition status', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'grv-1', status: 'filed' }])
        .mockResolvedValueOnce([{ id: 'grv-1', assigned_investigator_id: 'inv-1', status: 'investigating' }])
        .mockResolvedValueOnce([]);

      const result = await service.assignInvestigator('tenant-1', 'grv-1', 'admin-1', {
        investigator_id: 'inv-1',
        notes: 'Assigned to Lead Investigator',
      });

      expect(result.assigned_investigator_id).toBe('inv-1');
    });
  });

  describe('proposeResolution', () => {
    it('should propose resolution and update status to resolution_proposed', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'grv-1', status: 'investigating' }])
        .mockResolvedValueOnce([
          {
            id: 'grv-1',
            status: 'resolution_proposed',
            resolution_summary: 'Mediation agreement reached',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.proposeResolution('tenant-1', 'grv-1', 'admin-1', {
        resolution_summary: 'Mediation agreement reached',
        action_items: 'Team restructuring',
        retaliation_monitoring_flag: true,
      });

      expect(result.status).toBe('resolution_proposed');
    });
  });

  describe('submitFeedback', () => {
    it('should throw ForbiddenException if user is not the complainant', async () => {
      mockConnection.query.mockResolvedValueOnce([{ id: 'grv-1', user_id: 'user-1' }]);

      await expect(
        service.submitFeedback('tenant-1', 'grv-1', 'other-user', {
          satisfaction_score: 5,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should record score and close grievance', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'grv-1', user_id: 'user-1' }])
        .mockResolvedValueOnce([{ id: 'grv-1', satisfaction_score: 5, status: 'closed' }])
        .mockResolvedValueOnce([]);

      const result = await service.submitFeedback('tenant-1', 'grv-1', 'user-1', {
        satisfaction_score: 5,
        satisfaction_feedback: 'Resolved fairly and promptly',
      });

      expect(result.satisfaction_score).toBe(5);
      expect(result.status).toBe('closed');
    });
  });

  describe('addNote', () => {
    it('should add confidential note to timeline', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'grv-1' }])
        .mockResolvedValueOnce([{ id: 'tl-1', notes: 'Private interview notes' }]);

      const result = await service.addNote('tenant-1', 'grv-1', 'inv-1', {
        notes: 'Private interview notes',
        is_confidential: true,
      });

      expect(result.notes).toBe('Private interview notes');
    });
  });

  describe('getStats', () => {
    it('should return aggregated grievance statistics', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          {
            total_cases: '10',
            open_cases: '4',
            closed_cases: '6',
            sla_breached_cases: '1',
            retaliation_monitoring_count: '2',
            avg_resolution_days: '5.2',
          },
        ])
        .mockResolvedValueOnce([{ category: 'harassment', count: '4' }])
        .mockResolvedValueOnce([{ status: 'closed', count: '6' }]);

      const result = await service.getStats('tenant-1');
      expect(result.total_cases).toBe(10);
      expect(result.open_cases).toBe(4);
      expect(result.closed_cases).toBe(6);
      expect(result.sla_breached_cases).toBe(1);
      expect(result.retaliation_monitoring_count).toBe(2);
      expect(result.avg_resolution_days).toBe(5.2);
      expect(result.sla_compliance_rate).toBe(83); // (5 / 6) * 100 = 83%
      expect(result.by_category).toHaveLength(1);
      expect(result.by_status).toHaveLength(1);
    });
  });
});
