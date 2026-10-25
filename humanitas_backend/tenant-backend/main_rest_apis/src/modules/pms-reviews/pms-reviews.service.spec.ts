import { Test, TestingModule } from '@nestjs/testing';
import { PmsReviewsService } from './pms-reviews.service';
import { DatabaseService } from '../database/database.service';
import { NotFoundException } from '@nestjs/common';
import { ReviewCycleType, ReviewCycleStatus, PipStatus } from './dto/pms-reviews.dto';

describe('PmsReviewsService', () => {
  let service: PmsReviewsService;
  let mockConnection: any;

  beforeEach(async () => {
    mockConnection = {
      query: jest.fn(),
    };

    const mockDatabaseService = {
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PmsReviewsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<PmsReviewsService>(PmsReviewsService);
    // Mark tenant as ensured so ensureTables does not run in unit tests
    (service as any).ensuredTenants.add('test-tenant');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getReviewCycles', () => {
    it('should query review cycles and return results', async () => {
      const mockCycles = [
        { id: 'cycle-1', title: 'Q1 Review', total_participants: 10, completed_reviews: 5 },
      ];
      mockConnection.query.mockResolvedValue(mockCycles);

      const result = await service.getReviewCycles('test-tenant', 'comp-1');
      expect(result).toEqual(mockCycles);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT rc.*'),
        expect.arrayContaining(['comp-1'])
      );
    });
  });

  describe('getReviewCycleById', () => {
    it('should return cycle if found', async () => {
      const mockCycle = { id: 'cycle-1', title: 'Q1 Review' };
      mockConnection.query.mockResolvedValue([mockCycle]);

      const result = await service.getReviewCycleById('test-tenant', 'cycle-1');
      expect(result).toEqual(mockCycle);
    });

    it('should throw NotFoundException if cycle not found', async () => {
      mockConnection.query.mockResolvedValue([]);
      await expect(service.getReviewCycleById('test-tenant', 'not-exist')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('createReviewCycle', () => {
    it('should insert review cycle and enroll participants', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // insert cycle
        .mockResolvedValueOnce([{ manager_id: 'mgr-1' }]) // get manager
        .mockResolvedValueOnce([]) // insert employee_review
        .mockResolvedValueOnce([]) // insert self feedback
        .mockResolvedValueOnce([]) // insert manager feedback
        .mockResolvedValueOnce([{ id: 'new-cycle', title: 'Annual 2026' }]); // getReviewCycleById

      const dto = {
        title: 'Annual 2026',
        cycle_type: ReviewCycleType.ANNUAL,
        start_date: '2026-01-01',
        due_date: '2026-03-31',
        participant_ids: ['emp-1'],
      };

      const result = await service.createReviewCycle('test-tenant', dto as any, 'user-admin');
      expect(result).toBeDefined();
      expect(mockConnection.query).toHaveBeenCalled();
    });
  });

  describe('updateReviewCycle', () => {
    it('should update cycle status and title', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'cycle-1', title: 'Q1 Review' }]) // getReviewCycleById
        .mockResolvedValueOnce([]) // update
        .mockResolvedValueOnce([{ id: 'cycle-1', title: 'Q1 Review - Final', status: ReviewCycleStatus.CLOSED }]); // re-fetch

      const result = await service.updateReviewCycle('test-tenant', 'cycle-1', {
        title: 'Q1 Review - Final',
        status: ReviewCycleStatus.CLOSED,
      });

      expect(result.status).toBe(ReviewCycleStatus.CLOSED);
    });
  });

  describe('getMyReviews', () => {
    it('should return evaluations and feedback requests', async () => {
      const myEvals = [{ id: 'rev-1', cycle_title: 'Q1 Review' }];
      const myRequests = [
        { id: 'fb-1', status: 'pending', reviewer_type: 'peer' },
        { id: 'fb-2', status: 'submitted', reviewer_type: 'self' },
      ];
      mockConnection.query
        .mockResolvedValueOnce(myEvals)
        .mockResolvedValueOnce(myRequests);

      const result = await service.getMyReviews('test-tenant', 'user-123');
      expect(result.evaluations).toEqual(myEvals);
      expect(result.pending_requests).toHaveLength(1);
      expect(result.completed_requests).toHaveLength(1);
    });
  });

  describe('nominatePeers', () => {
    it('should insert peer feedback requests for nominated peers', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'rev-1', employee_id: 'emp-1', cycle_id: 'cycle-1' }]) // getReviewById
        .mockResolvedValueOnce([]) // feedbacks
        .mockResolvedValueOnce([]) // scores
        .mockResolvedValueOnce([]) // existing check
        .mockResolvedValueOnce([]); // insert peer feedback

      const result = await service.nominatePeers('test-tenant', 'rev-1', { peer_ids: ['peer-1'] }, 'emp-1');
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });
  });

  describe('submitFeedback', () => {
    it('should save overall rating, competency scores, and recalculate averages', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 'fb-1', review_id: 'rev-1' }]) // get feedback
        .mockResolvedValueOnce([]) // update feedback
        .mockResolvedValueOnce([]) // insert competency score
        .mockResolvedValueOnce([
          { reviewer_type: 'manager', overall_rating: 4.5 },
          { reviewer_type: 'self', overall_rating: 4.0 },
        ]) // recalculate query
        .mockResolvedValueOnce([]); // update employee_reviews

      const result = await service.submitFeedback(
        'test-tenant',
        'fb-1',
        {
          overall_rating: 4.5,
          general_feedback: 'Outstanding collaboration',
          competency_scores: [{ competency_id: 'comp-1', score: 5 }],
        },
        'mgr-1'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('calibrateReview', () => {
    it('should save calibrated rating and update review to completed', async () => {
      mockConnection.query
        .mockResolvedValueOnce([]) // update
        .mockResolvedValueOnce([{ id: 'rev-1', calibrated_rating: 4.8 }]) // getReviewById
        .mockResolvedValueOnce([]) // feedbacks
        .mockResolvedValueOnce([]); // scores

      const result = await service.calibrateReview(
        'test-tenant',
        'rev-1',
        { calibrated_rating: 4.8, manager_summary: 'Calibrated top performer' },
        'mgr-1'
      );

      expect(result.calibrated_rating).toBe(4.8);
    });
  });

  describe('createPip and updatePip', () => {
    it('should create a performance improvement plan', async () => {
      const mockPip = { id: 'pip-1', title: 'Target Improvement Plan', status: PipStatus.ACTIVE };
      mockConnection.query
        .mockResolvedValueOnce([]) // insert
        .mockResolvedValueOnce([mockPip]); // select

      const result = await service.createPip(
        'test-tenant',
        {
          employee_id: 'emp-1',
          title: 'Target Improvement Plan',
          reason: 'Missed sprint deadlines',
          action_plan: 'Bi-weekly pairing sessions',
          success_criteria: 'Zero missed story points',
          start_date: '2026-01-01',
          target_end_date: '2026-03-31',
        },
        'mgr-1'
      );

      expect(result.title).toBe('Target Improvement Plan');
      expect(result.status).toBe(PipStatus.ACTIVE);
    });

    it('should update PIP outcome status', async () => {
      const updatedPip = { id: 'pip-1', status: PipStatus.COMPLETED_SUCCESSFULLY };
      mockConnection.query
        .mockResolvedValueOnce([]) // update
        .mockResolvedValueOnce([updatedPip]); // select

      const result = await service.updatePip('test-tenant', 'pip-1', {
        status: PipStatus.COMPLETED_SUCCESSFULLY,
        outcome_notes: 'All objectives completed ahead of time',
      });

      expect(result.status).toBe(PipStatus.COMPLETED_SUCCESSFULLY);
    });
  });

  describe('getReviewAnalytics', () => {
    it('should compute bell curve distribution and department completion rates', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ count: 2 }]) // cycles count
        .mockResolvedValueOnce([
          { status: 'completed', final_rating: 4.5, department: 'Engineering' },
          { status: 'completed', final_rating: 3.5, department: 'Engineering' },
          { status: 'pending_self', final_rating: null, department: 'Sales' },
        ]) // all reviews
        .mockResolvedValueOnce([{ count: 1 }]); // active pips

      const stats = await service.getReviewAnalytics('test-tenant');
      expect(stats.total_cycles).toBe(2);
      expect(stats.total_reviews).toBe(3);
      expect(stats.completed_reviews).toBe(2);
      expect(stats.completion_rate).toBe(67);
      expect(stats.average_rating).toBe(4);
      expect(stats.rating_distribution['4.0-4.9 (Exceeds Expectations)']).toBe(1);
      expect(stats.rating_distribution['3.0-3.9 (Meets Expectations)']).toBe(1);
      expect(stats.department_stats).toHaveLength(2);
      expect(stats.active_pips).toBe(1);
    });
  });
});
