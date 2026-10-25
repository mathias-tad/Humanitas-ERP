import { Test, TestingModule } from '@nestjs/testing';
import { HrmsTrainingService } from './hrms-training.service';
import { DatabaseService } from '../database/database.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DeliveryMethod, EnrollmentStatus, SkillProficiency } from './dto/hrms-training.dto';

describe('HrmsTrainingService', () => {
  let service: HrmsTrainingService;
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
        HrmsTrainingService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<HrmsTrainingService>(HrmsTrainingService);
    (service as any).ensuredTenants.add('tenant-1');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCourses', () => {
    it('should return courses list with filters applied', async () => {
      const sample = [{ id: 'tc-1', title: 'Security 101', category: 'compliance' }];
      mockConnection.query.mockResolvedValueOnce(sample);

      const res = await service.getCourses('tenant-1', { category: 'compliance' });
      expect(res).toEqual(sample);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('AND c.category = $1'),
        ['compliance'],
      );
    });
  });

  describe('getCourseById', () => {
    it('should throw NotFoundException when course does not exist', async () => {
      mockConnection.query.mockResolvedValueOnce([]);
      await expect(service.getCourseById('tenant-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return course with sessions when found', async () => {
      const course = { id: 'tc-1', title: 'Security 101' };
      const sessions = [{ id: 's-1', course_id: 'tc-1' }];
      mockConnection.query
        .mockResolvedValueOnce([course])
        .mockResolvedValueOnce(sessions);

      const res = await service.getCourseById('tenant-1', 'tc-1');
      expect(res).toEqual({ ...course, sessions });
    });
  });

  describe('createCourse', () => {
    it('should insert and return new course', async () => {
      const created = { id: 'tc-new', title: 'New Course', category: 'technical' };
      mockConnection.query
        .mockResolvedValueOnce([]) // insert
        .mockResolvedValueOnce([created]) // getCourseById
        .mockResolvedValueOnce([]); // get sessions

      const res = await service.createCourse('tenant-1', {
        title: 'New Course',
        category: 'technical',
        delivery_method: DeliveryMethod.ONLINE,
      });

      expect(res.title).toBe('New Course');
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO training_courses'),
        expect.any(Array),
      );
    });
  });

  describe('updateCourse', () => {
    it('should update course fields', async () => {
      const existing = { id: 'tc-1', title: 'Old Title' };
      const updated = { id: 'tc-1', title: 'Updated Title' };
      mockConnection.query
        .mockResolvedValueOnce([existing]) // getCourseById
        .mockResolvedValueOnce([]) // get sessions
        .mockResolvedValueOnce([]) // update
        .mockResolvedValueOnce([updated]) // getCourseById after
        .mockResolvedValueOnce([]); // get sessions

      const res = await service.updateCourse('tenant-1', 'tc-1', { title: 'Updated Title' });
      expect(res.title).toBe('Updated Title');
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE training_courses SET title = $1'),
        expect.any(Array),
      );
    });
  });

  describe('createSession', () => {
    it('should insert and return new training cohort session', async () => {
      const course = { id: 'tc-1', title: 'Leadership' };
      const session = { id: 's-10', course_id: 'tc-1', instructor_name: 'Dr. Jane' };
      mockConnection.query
        .mockResolvedValueOnce([course]) // getCourseById
        .mockResolvedValueOnce([]) // sessions
        .mockResolvedValueOnce([]) // insert session
        .mockResolvedValueOnce([session]); // select session

      const res = await service.createSession('tenant-1', {
        course_id: 'tc-1',
        instructor_name: 'Dr. Jane',
        start_time: '2026-11-01T09:00:00Z',
        end_time: '2026-11-01T17:00:00Z',
      });

      expect(res.instructor_name).toBe('Dr. Jane');
    });
  });

  describe('enrollLearner', () => {
    it('should throw BadRequestException if learner is already enrolled', async () => {
      const course = { id: 'tc-1', title: 'Ethics' };
      mockConnection.query
        .mockResolvedValueOnce([course]) // getCourseById
        .mockResolvedValueOnce([]) // sessions
        .mockResolvedValueOnce([{ id: 'enr-exists' }]); // existing check

      await expect(
        service.enrollLearner('tenant-1', { course_id: 'tc-1', user_id: 'u-1' }, 'u-admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create confirmed enrollment when capacity is available', async () => {
      const course = { id: 'tc-1', title: 'Ethics' };
      const enrollment = { id: 'enr-new', status: 'confirmed' };
      mockConnection.query
        .mockResolvedValueOnce([course]) // getCourseById
        .mockResolvedValueOnce([]) // sessions
        .mockResolvedValueOnce([]) // existing check empty
        .mockResolvedValueOnce([]) // insert
        .mockResolvedValueOnce([enrollment]); // getEnrollmentById

      const res = await service.enrollLearner(
        'tenant-1',
        { course_id: 'tc-1', user_id: 'u-2' },
        'u-admin',
      );
      expect(res.status).toBe('confirmed');
    });

    it('should set status to waitlisted when session is full', async () => {
      const course = { id: 'tc-1', title: 'Safety' };
      const enrollment = { id: 'enr-wait', status: 'waitlisted' };
      mockConnection.query
        .mockResolvedValueOnce([course]) // getCourseById
        .mockResolvedValueOnce([]) // sessions
        .mockResolvedValueOnce([]) // existing check empty
        .mockResolvedValueOnce([{ max_participants: 10, enrolled: 10 }]) // session full
        .mockResolvedValueOnce([]) // insert
        .mockResolvedValueOnce([enrollment]); // getEnrollmentById

      const res = await service.enrollLearner(
        'tenant-1',
        { course_id: 'tc-1', session_id: 's-1', user_id: 'u-3' },
        'u-admin',
      );
      expect(res.status).toBe('waitlisted');
    });
  });

  describe('updateEnrollmentProgress', () => {
    it('should update progress, score and set completion date if 100%', async () => {
      const current = { id: 'enr-1', status: 'confirmed', completion_percentage: 50 };
      const updated = { id: 'enr-1', status: 'completed', completion_percentage: 100, score: 95 };

      mockConnection.query
        .mockResolvedValueOnce([current]) // getEnrollmentById
        .mockResolvedValueOnce([]) // update
        .mockResolvedValueOnce([updated]); // getEnrollmentById after

      const res = await service.updateEnrollmentProgress('tenant-1', 'enr-1', {
        completion_percentage: 100,
        score: 95,
        status: EnrollmentStatus.COMPLETED,
      });

      expect(res.status).toBe('completed');
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("completion_date = CURRENT_DATE"),
        expect.any(Array),
      );
    });
  });

  describe('upsertEmployeeSkill', () => {
    it('should insert new skill if not yet logged', async () => {
      const skill = { id: 'sk-1', skill_name: 'Kubernetes', proficiency_level: 'advanced' };
      mockConnection.query
        .mockResolvedValueOnce([]) // check existing
        .mockResolvedValueOnce([]) // insert
        .mockResolvedValueOnce([skill]); // select

      const res = await service.upsertEmployeeSkill(
        'tenant-1',
        {
          user_id: 'u-1',
          skill_name: 'Kubernetes',
          category: 'DevOps',
          proficiency_level: SkillProficiency.ADVANCED,
        },
        'u-admin',
      );

      expect(res.skill_name).toBe('Kubernetes');
    });

    it('should update existing skill level if already logged', async () => {
      const existing = { id: 'sk-1' };
      const updated = { id: 'sk-1', skill_name: 'Kubernetes', proficiency_level: 'expert' };
      mockConnection.query
        .mockResolvedValueOnce([existing]) // check existing
        .mockResolvedValueOnce([]) // update
        .mockResolvedValueOnce([updated]); // select

      const res = await service.upsertEmployeeSkill(
        'tenant-1',
        {
          user_id: 'u-1',
          skill_name: 'Kubernetes',
          category: 'DevOps',
          proficiency_level: SkillProficiency.EXPERT,
        },
        'u-admin',
      );

      expect(res.proficiency_level).toBe('expert');
    });
  });

  describe('getTrainingStats', () => {
    it('should aggregate courses, completion rate, compliance rate and skills', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ total_courses: '8', mandatory_courses: '3' }])
        .mockResolvedValueOnce([{
          total_enrollments: '40',
          completed_enrollments: '30',
          active_enrollments: '10',
          waitlisted_enrollments: '2',
          average_score: '88.5',
        }])
        .mockResolvedValueOnce([{ mandatory_assignments: '20', mandatory_completed: '18' }])
        .mockResolvedValueOnce([{ total_skills: '120', employees_with_skills: '25', verified_skills: '90' }]);

      const stats = await service.getTrainingStats('tenant-1');
      expect(stats.total_courses).toBe(8);
      expect(stats.mandatory_courses).toBe(3);
      expect(stats.completion_rate).toBe(75); // 30/40 * 100
      expect(stats.compliance_rate).toBe(90); // 18/20 * 100
      expect(stats.average_score).toBe(88.5);
      expect(stats.total_skills_logged).toBe(120);
    });
  });
});
