import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlatformKnowledgeService } from './platform-knowledge.service';
import { PlatformKnowledge } from './entities/platform-knowledge.entity';

describe('PlatformKnowledgeService', () => {
  let service: PlatformKnowledgeService;
  let repo: any;

  const mockKnowledge: PlatformKnowledge = {
    id: '11111111-1111-1111-1111-111111111111',
    category: 'system_features',
    title: 'Python Calculation Engine',
    content: 'Computes payroll tax brackets and inventory FIFO queues.',
    tags: ['python', 'payroll'],
    is_published: true,
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([mockKnowledge]),
  };

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      findOne: jest.fn().mockResolvedValue(mockKnowledge),
      create: jest.fn().mockImplementation((dto) => ({ ...mockKnowledge, ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      remove: jest.fn().mockResolvedValue(mockKnowledge),
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformKnowledgeService,
        {
          provide: getRepositoryToken(PlatformKnowledge),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<PlatformKnowledgeService>(PlatformKnowledgeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should list all knowledge items with category filter', async () => {
    const result = await service.findAll('system_features');
    expect(repo.createQueryBuilder).toHaveBeenCalled();
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('k.category = :category', {
      category: 'system_features',
    });
    expect(result).toEqual([mockKnowledge]);
  });

  it('should find one knowledge item by id', async () => {
    const result = await service.findOne(mockKnowledge.id);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: mockKnowledge.id } });
    expect(result.title).toBe(mockKnowledge.title);
  });

  it('should create a new knowledge entry', async () => {
    const dto = {
      title: 'New Feature',
      content: 'Detailed facts',
      category: 'pricing_plans',
    };
    const result = await service.create(dto);
    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
    expect(result.title).toBe('New Feature');
  });

  it('should seed default platform knowledge when empty', async () => {
    repo.count.mockResolvedValueOnce(0);
    const result = await service.seedDefaults();
    expect(repo.save).toHaveBeenCalled();
    expect(result.count).toBeGreaterThan(0);
  });
});
