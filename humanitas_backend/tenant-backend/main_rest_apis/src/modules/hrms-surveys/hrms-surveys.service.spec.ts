import { Test, TestingModule } from '@nestjs/testing';
import { HrmsSurveysService } from './hrms-surveys.service';
import { DatabaseService } from '../database/database.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SurveyStatus, SurveyType, QuestionType } from './dto/hrms-surveys.dto';

describe('HrmsSurveysService', () => {
  let service: HrmsSurveysService;
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
        HrmsSurveysService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<HrmsSurveysService>(HrmsSurveysService);
    (service as any).ensuredTenants.add('test-tenant');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSurveys and getSurveyById', () => {
    it('should return surveys list with counts', async () => {
      const mockList = [{ id: 's-1', title: 'Q1 Pulse', response_count: 5 }];
      mockConnection.query.mockResolvedValueOnce(mockList);

      const result = await service.getSurveys('test-tenant');
      expect(result).toEqual(mockList);
    });

    it('should return survey details with parsed questions', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 's-1', title: 'Q1 Pulse', is_anonymous: true }])
        .mockResolvedValueOnce([
          { id: 'q-1', question_text: 'Rating?', question_type: 'rating_scale', options: '["A", "B"]' },
        ]);

      const result = await service.getSurveyById('test-tenant', 's-1');
      expect(result.id).toBe('s-1');
      expect(result.questions[0].options).toEqual(['A', 'B']);
    });
  });

  describe('createSurvey', () => {
    it('should create survey and insert question records', async () => {
      mockConnection.query
        .mockResolvedValueOnce({ affectedRows: 1 }) // insert survey
        .mockResolvedValueOnce({ affectedRows: 1 }) // insert question
        .mockResolvedValueOnce([{ id: 's-new', title: 'Culture Check' }]) // getSurveyById survey
        .mockResolvedValueOnce([]); // getSurveyById questions

      const result = await service.createSurvey(
        'test-tenant',
        {
          title: 'Culture Check',
          survey_type: SurveyType.CULTURE,
          questions: [
            {
              question_text: 'Do you feel included?',
              question_type: QuestionType.RATING_SCALE,
            },
          ],
        },
        'user-1'
      );

      expect(result.id).toBe('s-new');
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO surveys'),
        expect.any(Array)
      );
    });
  });

  describe('submitResponse', () => {
    it('should throw BadRequestException if survey is closed', async () => {
      mockConnection.query.mockResolvedValueOnce([
        { id: 's-1', status: SurveyStatus.CLOSED },
      ]);

      await expect(
        service.submitResponse('test-tenant', { survey_id: 's-1', answers: [] })
      ).rejects.toThrow(BadRequestException);
    });

    it('should submit anonymous response with NULL userId', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 's-1', status: SurveyStatus.ACTIVE, is_anonymous: true }])
        .mockResolvedValueOnce({ affectedRows: 1 }) // insert response
        .mockResolvedValueOnce({ affectedRows: 1 }); // insert answer

      const result = await service.submitResponse(
        'test-tenant',
        {
          survey_id: 's-1',
          answers: [{ question_id: 'q-1', rating_value: 5 }],
        },
        'employee-1'
      );

      expect(result.success).toBe(true);
      expect(result.is_anonymous).toBe(true);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO survey_responses'),
        expect.arrayContaining(['s-1', null])
      );
    });
  });

  describe('getSurveyResults and eNPS', () => {
    it('should hide breakdown if responses are below threshold', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 's-1', min_responses_for_results: 5 }])
        .mockResolvedValueOnce([{ count: '2' }]); // only 2 responses

      const result = await service.getSurveyResults('test-tenant', 's-1');
      expect(result.threshold_met).toBe(false);
      expect(result.message).toContain('preserve employee anonymity');
    });

    it('should calculate eNPS score when threshold is met', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ id: 's-1', min_responses_for_results: 3 }])
        .mockResolvedValueOnce([{ count: '10' }]) // 10 responses
        .mockResolvedValueOnce([
          { id: 'q-1', question_text: 'Recommend?', question_type: QuestionType.NPS },
        ])
        .mockResolvedValueOnce([
          {
            promoters: '7',
            passives: '2',
            detractors: '1',
            avg_score: '8.8',
            total_answers: '10',
          },
        ]);

      const result = await service.getSurveyResults('test-tenant', 's-1');
      expect(result.threshold_met).toBe(true);
      // Promoters 70% - Detractors 10% = 60
      expect(result.overall_enps).toBe(60);
      expect(result.questions[0].enps_score).toBe(60);
    });
  });

  describe('Action items and Analytics', () => {
    it('should create action item', async () => {
      mockConnection.query
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([{ id: 'ai-1', title: 'Improve 1-on-1s' }]);

      const result = await service.createActionItem('test-tenant', {
        survey_id: 's-1',
        title: 'Improve 1-on-1s',
      });

      expect(result.title).toBe('Improve 1-on-1s');
    });

    it('should return survey analytics summary', async () => {
      mockConnection.query
        .mockResolvedValueOnce([
          { total_surveys: '4', active_surveys: '2', total_responses: '48' },
        ])
        .mockResolvedValueOnce([
          { promoters: '30', passives: '10', detractors: '10', total_nps_responses: '50' },
        ])
        .mockResolvedValueOnce([{ total_actions: '5', completed_actions: '3' }]);

      const result = await service.getSurveyAnalytics('test-tenant');
      expect(result.total_surveys).toBe(4);
      expect(result.active_surveys).toBe(2);
      expect(result.enps_score).toBe(40); // (30 - 10)/50 = 40%
      expect(result.total_action_items).toBe(5);
    });
  });
});
