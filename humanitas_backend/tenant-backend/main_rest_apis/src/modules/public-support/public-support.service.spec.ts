import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PublicSupportService } from './public-support.service';
import { PlatformKnowledge } from './entities/platform-knowledge.entity';
import { SupportTicket } from './entities/support-ticket.entity';

describe('PublicSupportService', () => {
  let service: PublicSupportService;
  let knowledgeRepo: any;
  let ticketRepo: any;

  const mockKnowledge: PlatformKnowledge[] = [
    {
      id: '1',
      category: 'system_features',
      title: 'Python Calculation Engine',
      content: 'All complex tax brackets and inventory FIFO costing are calculated by Python engine.',
      tags: ['payroll', 'tax', 'python'],
      is_published: true,
      metadata: {},
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '2',
      category: 'security_compliance',
      title: 'Database Isolation Standards',
      content: 'Dedicated PostgreSQL database is dynamically provisioned per tenant with zero data leakage.',
      tags: ['security', 'database', 'isolation'],
      is_published: true,
      metadata: {},
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  const mockTicket: SupportTicket = {
    id: 'ticket-1',
    ticket_number: 'TICK-202611-0001',
    subject: 'Assistance Needed',
    description: 'Question about integration',
    contact_email: 'user@acme.com',
    contact_name: 'User',
    tenant_id: undefined as any,
    category: 'general',
    priority: 'medium',
    status: 'open',
    created_by_type: 'ai_on_behalf',
    ai_conversation_summary: 'Inquiry details',
    resolution_notes: null as any,
    resolved_at: null as any,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    knowledgeRepo = {
      find: jest.fn().mockResolvedValue(mockKnowledge),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockKnowledge),
      }),
    };

    ticketRepo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((dto) => ({ ...mockTicket, ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.ticket_number === mockTicket.ticket_number) {
          return Promise.resolve(mockTicket);
        }
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicSupportService,
        {
          provide: getRepositoryToken(PlatformKnowledge),
          useValue: knowledgeRepo,
        },
        {
          provide: getRepositoryToken(SupportTicket),
          useValue: ticketRepo,
        },
      ],
    }).compile();

    service = module.get<PublicSupportService>(PublicSupportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should answer grounded questions using published platform knowledge', async () => {
    const res = await service.landingAiChat({
      message: 'How does the Python calculation engine work?',
    });

    expect(res.reply).toContain('Python engine');
    expect(res.citations?.length).toBeGreaterThan(0);
    expect(res.escalateSuggested).toBe(false);
  });

  it('in HRMS repo, should route questions about ERP modules to humanitas-erp.ziontech.tech', async () => {
    const res = await service.landingAiChat(
      { message: 'Do you have inventory and warehouse management with FIFO?' },
      true // isHrmsOnly
    );

    expect(res.reply).toContain('humanitas-erp.ziontech.tech');
    expect(res.reply).toContain('Humanitas ERP');
    expect(res.citations).toContain('Humanitas ERP Architecture Directive');
  });

  it('should suggest ticket escalation when user requests human support', async () => {
    const res = await service.landingAiChat({
      message: 'I want to speak to a human representative or create a ticket',
    });

    expect(res.escalateSuggested).toBe(true);
    expect(res.draftTicket).toBeDefined();
    expect(res.reply).toContain('support ticket');
  });

  it('should create ticket on behalf of tenant when user confirms draft with email', async () => {
    const res = await service.landingAiChat({
      message: 'confirm',
      userEmail: 'ceo@acme.com',
      userName: 'Alice Smith',
      history: [
        { role: 'user', content: 'We need enterprise custom SLA pricing.' },
        { role: 'assistant', content: 'Would you like me to create a ticket?' },
      ],
    });

    expect(ticketRepo.create).toHaveBeenCalled();
    expect(ticketRepo.save).toHaveBeenCalled();
    expect(res.ticketCreated).toBe(true);
    expect(res.ticketNumber).toBeDefined();
    expect(res.reply).toContain('Support Ticket Created on Your Behalf');
  });

  it('should track ticket status by ticket number and email', async () => {
    const res = await service.trackTicket('TICK-202611-0001', 'user@acme.com');
    expect(res.ticket_number).toBe('TICK-202611-0001');
    expect(res.status).toBe('open');
    expect(res.created_by_type).toBe('ai_on_behalf');
  });

  it('should return AI offline status and ticket draft when AI is not configured', async () => {
    jest.spyOn(service, 'isAiConfigured').mockReturnValue(false);

    const status = service.getAiStatus();
    expect(status.available).toBe(false);
    expect(status.mode).toBe('unavailable');

    const chatRes = await service.landingAiChat({
      message: 'What is the pricing for 500 employees?',
    });

    expect(chatRes.available).toBe(false);
    expect(chatRes.escalateSuggested).toBe(true);
    expect(chatRes.redirectToTicket).toBe(true);
    expect(chatRes.draftTicket).toBeDefined();
    expect(chatRes.reply).toContain('not configured or available');
  });

  it('should return strict zero-guessing reply and ticket draft when question is unanswerable', async () => {
    const res = await service.landingAiChat({
      message: 'Can you fly an astronaut rocket spaceship to planet Mars tomorrow?',
    });

    expect(res.escalateSuggested).toBe(true);
    expect(res.redirectToTicket).toBe(true);
    expect(res.draftTicket).toBeDefined();
    expect(res.reply).toContain('Strict Zero-Guessing Policy');
  });
});
