import { RecruitmentService } from './recruitment.service';
import { of } from 'rxjs';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('RecruitmentPipelineService Unit Tests', () => {
  let service: RecruitmentService;
  let mockHttpService: any;
  let mockSettingsService: any;
  let mockConfigService: any;
  let mockTenantRepo: any;
  let mockDatabaseService: any;
  let mockOnboardingService: any;
  let mockNotificationsService: any;
  let mockConnection: any;

  beforeEach(() => {
    mockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
    };
    mockSettingsService = {
      getIntegrationsSettings: jest.fn().mockResolvedValue({ krinai_api_key: 'test-krinai-key' }),
    };
    mockConfigService = {
      get: jest.fn(),
    };
    mockTenantRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        slug: 'demo-tenant',
        database_name: 'demo_tenant_db',
      }),
    };
    mockConnection = {
      options: { database: 'demo_tenant_db' },
      query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
          return [];
        }
        return [];
      }),
    };
    mockDatabaseService = {
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
      getTenantConnection: jest.fn().mockResolvedValue(mockConnection),
    };
    mockOnboardingService = {
      startOnboarding: jest.fn().mockResolvedValue({
        id: 'onb-123',
        status: 'in_progress',
        start_date: '2026-11-01',
      }),
    };
    mockNotificationsService = {
      getEffectiveChannel: jest.fn().mockResolvedValue('both'),
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    service = new RecruitmentService(
      mockHttpService,
      mockSettingsService,
      mockConfigService,
      mockTenantRepo,
      mockDatabaseService,
      mockOnboardingService,
      mockNotificationsService,
    );
    // Mark database as ensured in tests so ensureRecruitmentTables does not consume mock query queues
    (service as any).ensuredDatabases.add('demo_tenant_db');
  });

  describe('Database Schema & Table Initialization', () => {
    it('creates recruitment_interviews and recruitment_offers tables idempotently', async () => {
      (service as any).ensuredDatabases.clear();
      mockConnection.query.mockResolvedValue([]);
      await service.ensureRecruitmentTables(mockConnection);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS recruitment_interviews'),
      );
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS recruitment_offers'),
      );
    });
  });

  describe('Interview Scheduling & Calendar', () => {
    it('creates an interview and dispatches notification to interviewer', async () => {
      const interviewRecord = {
        id: 'int-001',
        job_id: 'job-101',
        candidate_id: 'cand-501',
        candidate_name: 'Sarah Connor',
        candidate_email: 'sarah@example.com',
        interviewer_id: 'user-888',
        interviewer_name: 'John Doe',
        interview_type: 'technical',
        scheduled_at: '2026-11-05T10:00:00Z',
        duration_minutes: 60,
        status: 'scheduled',
      };
      mockConnection.query.mockResolvedValueOnce([interviewRecord]);

      const result = await service.createInterview('11111111-1111-1111-1111-111111111111', {
        job_id: 'job-101',
        candidate_id: 'cand-501',
        candidate_name: 'Sarah Connor',
        candidate_email: 'sarah@example.com',
        interviewer_id: 'user-888',
        interviewer_name: 'John Doe',
        interview_type: 'technical',
        scheduled_at: '2026-11-05T10:00:00Z',
        duration_minutes: 60,
      });

      expect(result).toEqual(interviewRecord);
      expect(mockNotificationsService.getEffectiveChannel).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'user-888',
        'recruitment_interview_scheduled',
      );
      expect(mockNotificationsService.createNotification).toHaveBeenCalled();
    });

    it('lists interviews with filters including job_id and multi-branch scoping', async () => {
      const interviews = [
        { id: 'int-1', job_id: 'job-101', candidate_name: 'Candidate A', company_id: 'comp-1' },
      ];
      mockConnection.query.mockResolvedValueOnce(interviews);

      const result = await service.getInterviews('demo-tenant', {
        job_id: 'job-101',
        company_id: 'comp-1',
      });

      expect(result).toEqual(interviews);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('AND job_id = $1'),
        expect.arrayContaining(['job-101', 'comp-1']),
      );
    });

    it('updates interview feedback, rating and status', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'int-1', status: 'scheduled' }]) // existing check
        .mockResolvedValueOnce([{ id: 'int-1', status: 'completed', rating: 5, feedback: 'Great performance' }]); // update

      const updated = await service.updateInterview('demo-tenant', 'int-1', {
        status: 'completed',
        rating: 5,
        feedback: 'Great performance',
      });

      expect(updated.status).toBe('completed');
      expect(updated.rating).toBe(5);
      expect(updated.feedback).toBe('Great performance');
    });
  });

  describe('Offer Letters & Digital Acceptance', () => {
    it('creates an offer letter with generated default content and sends notification', async () => {
      const createdOffer = {
        id: 'off-001',
        job_id: 'job-101',
        candidate_id: 'cand-501',
        candidate_name: 'Sarah Connor',
        position_title: 'Senior Software Engineer',
        offered_salary: 120000,
        currency: 'USD',
        status: 'draft',
      };
      mockConnection.query.mockResolvedValueOnce([createdOffer]);

      const result = await service.createOffer(
        '11111111-1111-1111-1111-111111111111',
        {
          job_id: 'job-101',
          candidate_id: 'cand-501',
          candidate_name: 'Sarah Connor',
          position_title: 'Senior Software Engineer',
          offered_salary: 120000,
        },
        'hr-manager-uuid',
      );

      expect(result).toEqual(createdOffer);
      expect(mockNotificationsService.getEffectiveChannel).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'hr-manager-uuid',
        'recruitment_offer_generated',
      );
    });

    it('updates offer status and sets signed_at timestamp on acceptance', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'off-1', status: 'draft', signed_at: null }])
        .mockResolvedValueOnce([{ id: 'off-1', status: 'accepted', signed_at: '2026-10-25T12:00:00Z' }]);

      const result = await service.updateOfferStatus('demo-tenant', 'off-1', {
        status: 'accepted',
      });

      expect(result.status).toBe('accepted');
      expect(result.signed_at).toBeDefined();
    });
  });

  describe('1-Click Candidate-to-Employee Conversion', () => {
    it('creates employee user, auto-starts onboarding workflow, marks offer accepted and candidate hired', async () => {
      // 1. check existing user -> none
      // 2. insert into users -> returns employee
      // 3. update recruitment_offers -> accepted
      mockConnection.query
        .mockResolvedValueOnce([]) // users check (empty)
        .mockResolvedValueOnce([
          {
            id: 'emp-999',
            email: 'sarah.connor@example.com',
            first_name: 'Sarah',
            last_name: 'Connor',
            full_name: 'Sarah Connor',
            department: 'Engineering',
            position: 'Staff Engineer',
          },
        ]) // users insert
        .mockResolvedValueOnce([{ id: 'off-1', status: 'accepted' }]); // update offer

      mockHttpService.patch.mockReturnValueOnce(of({ data: { success: true } }));

      const conversion = await service.convertToEmployee(
        '11111111-1111-1111-1111-111111111111',
        'cand-501',
        {
          job_id: 'job-101',
          first_name: 'Sarah',
          last_name: 'Connor',
          email: 'sarah.connor@example.com',
          department: 'Engineering',
          position_title: 'Staff Engineer',
          start_date: '2026-11-15',
          salary: 130000,
          company_id: 'comp-10',
          branch_id: 'branch-20',
          template_id: 'tpl-onb-1',
        },
        'admin-user-id',
      );

      expect(conversion.success).toBe(true);
      expect(conversion.employee.id).toBe('emp-999');
      expect(mockOnboardingService.startOnboarding).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        expect.objectContaining({
          user_id: 'emp-999',
          template_id: 'tpl-onb-1',
          start_date: '2026-11-15',
        }),
        'admin-user-id',
      );
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'admin-user-id',
        expect.objectContaining({
          type: 'recruitment_candidate_hired',
        }),
      );
    });
  });

  describe('Recruitment Analytics & Reports', () => {
    it('calculates funnel stage counts and conversion rates accurately', async () => {
      // 1. interviews count
      mockConnection.query
        .mockResolvedValueOnce([{ count: '20' }])
        // 2. offers counts: total_offers, hired, rejected
        .mockResolvedValueOnce([{ total_offers: '10', hired: '8', rejected: '2' }]);

      // Krinai applications mock
      mockHttpService.get.mockReturnValueOnce(
        of({
          data: {
            items: new Array(100).fill({ id: 'app' }),
            total: 100,
          },
        }),
      );

      const funnel = await service.getFunnelReport('demo-tenant', { job_id: 'job-101' });

      expect(funnel.applied).toBe(100);
      expect(funnel.interview).toBe(20);
      expect(funnel.offer).toBe(10);
      expect(funnel.hired).toBe(8);
      expect(funnel.rejected).toBe(2);
      expect(funnel.conversion_rates.applicant_to_interview_rate).toBe(20.0);
      expect(funnel.conversion_rates.interview_to_offer_rate).toBe(50.0);
      expect(funnel.conversion_rates.offer_to_hired_rate).toBe(80.0);
      expect(funnel.conversion_rates.overall_conversion_rate).toBe(8.0);
    });

    it('calculates recruitment analytics KPIs and department breakdown', async () => {
      // 1. time to hire
      mockConnection.query
        .mockResolvedValueOnce([{ avg_days: '19.4' }])
        // 2. filled positions & avg salary
        .mockResolvedValueOnce([{ count: '12', avg_salary: '75000' }])
        // 3. department breakdown
        .mockResolvedValueOnce([
          { department: 'Engineering', total_offers: '8', hired_count: '6' },
          { department: 'Sales', total_offers: '5', hired_count: '4' },
        ]);

      mockHttpService.get.mockReturnValueOnce(
        of({
          data: {
            items: [{ id: 'j1', status: 'open' }, { id: 'j2', status: 'open' }],
            total: 2,
          },
        }),
      );

      const analytics = await service.getAnalyticsReport('demo-tenant');

      expect(analytics.time_to_hire_days).toBe(19.4);
      expect(analytics.filled_positions_count).toBe(12);
      expect(analytics.cost_per_hire_avg).toBe(6000.0);
      expect(analytics.department_breakdown).toHaveLength(2);
      expect(analytics.department_breakdown[0].department).toBe('Engineering');
    });
  });
});
