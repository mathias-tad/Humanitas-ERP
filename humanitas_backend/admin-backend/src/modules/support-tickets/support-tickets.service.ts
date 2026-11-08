import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket } from './entities/support-ticket.entity';
import {
  CreateSupportTicketDto,
  UpdateSupportTicketDto,
  SupportTicketFilterDto,
} from './dto/support-ticket.dto';

@Injectable()
export class SupportTicketsService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
  ) {}

  async findAll(query: SupportTicketFilterDto) {
    const qb = this.ticketRepo.createQueryBuilder('t');

    if (query.status && query.status !== 'all') {
      qb.andWhere('t.status = :status', { status: query.status });
    }

    if (query.created_by_type && query.created_by_type !== 'all') {
      qb.andWhere('t.created_by_type = :created_by_type', {
        created_by_type: query.created_by_type,
      });
    }

    if (query.priority && query.priority !== 'all') {
      qb.andWhere('t.priority = :priority', { priority: query.priority });
    }

    if (query.category && query.category !== 'all') {
      qb.andWhere('t.category = :category', { category: query.category });
    }

    if (query.search) {
      qb.andWhere(
        '(t.ticket_number ILIKE :search OR t.subject ILIKE :search OR t.contact_email ILIKE :search OR t.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('t.created_at', 'DESC');
    return qb.getMany();
  }

  async getMetrics() {
    const total = await this.ticketRepo.count();
    const open = await this.ticketRepo.count({ where: { status: 'open' } });
    const inProgress = await this.ticketRepo.count({ where: { status: 'in_progress' } });
    const resolved = await this.ticketRepo.count({ where: { status: 'resolved' } });
    const closed = await this.ticketRepo.count({ where: { status: 'closed' } });

    const createdByAi = await this.ticketRepo.count({
      where: { created_by_type: 'ai_on_behalf' },
    });
    const createdByTenant = await this.ticketRepo.count({
      where: { created_by_type: 'tenant' },
    });

    return {
      total,
      open,
      inProgress,
      resolved,
      closed,
      createdByAi,
      createdByTenant,
    };
  }

  async findOne(id: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Support ticket ${id} not found`);
    }
    return ticket;
  }

  async findByTicketNumber(ticketNumber: string) {
    const ticket = await this.ticketRepo.findOne({ where: { ticket_number: ticketNumber } });
    if (!ticket) {
      throw new NotFoundException(`Ticket #${ticketNumber} not found`);
    }
    return ticket;
  }

  async create(dto: CreateSupportTicketDto) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Count tickets created this month to generate sequential number
    const count = await this.ticketRepo.count();
    const sequence = String(count + 1).padStart(4, '0');
    const ticketNumber = `TICK-${yearMonth}-${sequence}`;

    const ticket = this.ticketRepo.create({
      ticket_number: ticketNumber,
      subject: dto.subject,
      description: dto.description,
      contact_email: dto.contact_email,
      contact_name: dto.contact_name || dto.contact_email.split('@')[0],
      tenant_id: dto.tenant_id,
      category: dto.category || 'general',
      priority: dto.priority || 'medium',
      status: 'open',
      created_by_type: dto.created_by_type || 'tenant',
      ai_conversation_summary: dto.ai_conversation_summary || undefined,
    });

    return this.ticketRepo.save(ticket);
  }

  async update(id: string, dto: UpdateSupportTicketDto) {
    const ticket = await this.findOne(id);

    if (dto.status) {
      ticket.status = dto.status;
      if (dto.status === 'resolved' && !ticket.resolved_at) {
        ticket.resolved_at = new Date();
      }
    }

    if (dto.priority) {
      ticket.priority = dto.priority;
    }

    if (dto.resolution_notes !== undefined) {
      ticket.resolution_notes = dto.resolution_notes;
    }

    if (dto.category) {
      ticket.category = dto.category;
    }

    return this.ticketRepo.save(ticket);
  }

  async remove(id: string) {
    const ticket = await this.findOne(id);
    await this.ticketRepo.remove(ticket);
    return { success: true, message: `Ticket ${ticket.ticket_number} deleted` };
  }
}
