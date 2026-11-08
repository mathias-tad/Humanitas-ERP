import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SupportTicketsService } from './support-tickets.service';
import { SupportTicket } from './entities/support-ticket.entity';

describe('SupportTicketsService', () => {
  let service: SupportTicketsService;
  let repo: any;

  const mockTicket: SupportTicket = {
    id: '22222222-2222-2222-2222-222222222222',
    ticket_number: 'TICK-202611-0001',
    subject: 'Enterprise Setup Assistance',
    description: 'Need customized setup for 5 companies.',
    contact_email: 'tenant@acme.com',
    contact_name: 'Acme Admin',
    tenant_id: undefined as any,
    category: 'onboarding',
    priority: 'high',
    status: 'open',
    created_by_type: 'ai_on_behalf',
    ai_conversation_summary: 'User requested multi-company deployment assistance.',
    resolution_notes: null as any,
    resolved_at: null as any,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([mockTicket]),
  };

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      findOne: jest.fn().mockResolvedValue(mockTicket),
      create: jest.fn().mockImplementation((dto) => ({ ...mockTicket, ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      remove: jest.fn().mockResolvedValue(mockTicket),
      count: jest.fn().mockImplementation((args) => {
        if (!args) return Promise.resolve(10);
        if (args.where?.created_by_type === 'ai_on_behalf') return Promise.resolve(4);
        if (args.where?.created_by_type === 'tenant') return Promise.resolve(6);
        if (args.where?.status === 'open') return Promise.resolve(5);
        if (args.where?.status === 'in_progress') return Promise.resolve(3);
        if (args.where?.status === 'resolved') return Promise.resolve(2);
        return Promise.resolve(0);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportTicketsService,
        {
          provide: getRepositoryToken(SupportTicket),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<SupportTicketsService>(SupportTicketsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate sequential ticket number and create ticket with AI on behalf origin', async () => {
    const dto = {
      subject: 'Inquiry',
      description: 'Details',
      contact_email: 'test@example.com',
      created_by_type: 'ai_on_behalf',
      ai_conversation_summary: 'Context',
    };

    const ticket = await service.create(dto);
    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
    expect(ticket.created_by_type).toBe('ai_on_behalf');
    expect(ticket.ticket_number).toMatch(/^TICK-\d{6}-\d{4}$/);
  });

  it('should calculate metrics distinguishing AI on behalf vs tenant direct', async () => {
    const metrics = await service.getMetrics();
    expect(metrics.total).toBe(10);
    expect(metrics.createdByAi).toBe(4);
    expect(metrics.createdByTenant).toBe(6);
    expect(metrics.open).toBe(5);
  });

  it('should update ticket status and set resolved_at when resolved', async () => {
    const updated = await service.update(mockTicket.id, {
      status: 'resolved',
      resolution_notes: 'Issue resolved by engineer.',
    });
    expect(updated.status).toBe('resolved');
    expect(updated.resolved_at).toBeDefined();
    expect(updated.resolution_notes).toBe('Issue resolved by engineer.');
  });
});
