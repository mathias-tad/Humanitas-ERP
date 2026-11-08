import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { PlatformKnowledge } from './entities/platform-knowledge.entity';
import { SupportTicket } from './entities/support-ticket.entity';
import { LandingAiChatDto, CreatePublicTicketDto } from './dto/public-support.dto';

@Injectable()
export class PublicSupportService {
  constructor(
    @InjectRepository(PlatformKnowledge)
    private readonly knowledgeRepo: Repository<PlatformKnowledge>,
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
  ) {}

  /**
   * Public Landing Page AI Chat with strict zero-guessing and ticket drafting
   */
  async landingAiChat(dto: LandingAiChatDto, isHrmsOnly = false) {
    const rawMessage = (dto.message || '').trim();
    const lowerMessage = rawMessage.toLowerCase();

    // 1. HRMS Repo Guard: If user asks about ERP modules in HRMS, route to Humanitas ERP
    if (isHrmsOnly) {
      const erpKeywords = [
        'erp', 'inventory', 'warehouse', 'products', 'product catalog',
        'purchasing', 'vendor', 'vendors', 'sales', 'quotation', 'pos',
        'point of sale', 'accounting', 'general ledger', 'fifo', 'avco', 'zatca'
      ];
      const mentionsErp = erpKeywords.some(kw => lowerMessage.includes(kw));

      if (mentionsErp) {
        return {
          reply: `**Humanitas** is exclusively dedicated to **Human Capital Management (HRMS)** and **Project Management (PMS)**.

For full enterprise ERP business capabilities — including **Products & QR Catalog**, **Multi-Warehouse Inventory (FIFO/AVCO)**, **Purchasing & 3-Way Match**, **Sales & CRM Invoicing (ZATCA compliant)**, **Offline Point of Sale (POS)**, and **Double-Entry Financial Accounting** — please visit **Humanitas ERP**:

🌐 **Platform URL**: [humanitas-erp.ziontech.tech](https://humanitas-erp.ziontech.tech)
🔗 **Direct Link**: https://humanitas-erp.ziontech.tech

Would you like more details on HRMS workforce capabilities, or would you like to speak to our platform team regarding an enterprise ERP package?`,
          citations: ['Humanitas ERP Architecture Directive'],
          escalateSuggested: false,
        };
      }
    }

    // 2. Check for explicit ticket escalation or human support request
    const escalationTriggers = [
      'human', 'agent', 'support ticket', 'create ticket', 'open ticket',
      'talk to a person', 'representative', 'customer service', 'help center',
      'complaint', 'file a ticket', 'contact sales', 'custom quote', 'custom deal',
      'enterprise contract', 'billing dispute'
    ];
    const isEscalationRequest = escalationTriggers.some(kw => lowerMessage.includes(kw));

    // 3. Check if user is confirming a ticket draft
    const confirmKeywords = ['confirm', 'yes submit', 'create it', 'submit ticket', 'go ahead', 'yes please'];
    const isConfirming = confirmKeywords.some(kw => lowerMessage === kw || lowerMessage.startsWith(kw));

    const detectedConfirmEmail = dto.userEmail || this.extractEmail(rawMessage);
    if (isConfirming && detectedConfirmEmail) {
      const email = detectedConfirmEmail;
      const subject = this.generateSubject(rawMessage, dto.history);
      const summary = this.buildSummary(rawMessage, dto.history);

      const result = await this.createTicket({
        subject,
        description: rawMessage.length > 20 ? rawMessage : `Inquiry escalated via Landing Page AI Assistant:\n${summary}`,
        contact_email: email,
        contact_name: dto.userName || email.split('@')[0],
        category: this.detectCategory(lowerMessage),
        priority: 'medium',
        created_by_type: 'ai_on_behalf',
        ai_conversation_summary: summary,
      });

      return {
        reply: `✅ **Support Ticket Created on Your Behalf!**

Your ticket has been submitted to the Humanitas platform operations team:
- **Ticket Number**: \`${result.ticket_number}\`
- **Contact Email**: ${result.ticket.contact_email}
- **Subject**: ${result.ticket.subject}
- **Status**: Open (High Priority Routing)

Our human support team will review your inquiry and follow up directly via email. You can also track this ticket anytime using your ticket number.`,
        ticketCreated: true,
        ticketNumber: result.ticket_number,
      };
    }

    // 4. Search published platform knowledge in Master DB
    const published = await this.knowledgeRepo.find({
      where: { is_published: true },
    });

    const matchingArticles: PlatformKnowledge[] = [];
    const queryTokens = lowerMessage
      .replace(/[^\w\s]/gi, '')
      .split(/\s+/)
      .filter(t => t.length > 2);

    for (const item of published) {
      const itemText = `${item.title} ${item.content} ${(item.tags || []).join(' ')}`.toLowerCase();
      let matchScore = 0;

      for (const token of queryTokens) {
        if (itemText.includes(token)) {
          matchScore += 1;
        }
      }

      if (matchScore > 0 || lowerMessage.includes(item.category.toLowerCase())) {
        matchingArticles.push(item);
      }
    }

    // 5. If user asked for human support or no knowledge matched
    if (isEscalationRequest || matchingArticles.length === 0) {
      // Suggest ticket creation with interactive draft
      const detectedEmail = dto.userEmail || this.extractEmail(rawMessage);
      const draftSubject = this.generateSubject(rawMessage, dto.history);

      return {
        reply: isEscalationRequest
          ? `I'd be glad to connect you with our human platform support specialists!

Would you like me to create a support ticket for you right now? I can draft the details so you can review and confirm before submission.`
          : `I could not find a verified answer to your exact question in our official platform documentation. Per our **Strict Zero-Guessing Policy**, I never speculate or fabricate facts.

Would you like me to create a support ticket for our human specialists to answer your question directly?`,
        escalateSuggested: true,
        draftTicket: {
          subject: draftSubject,
          category: this.detectCategory(lowerMessage),
          description: rawMessage,
          contact_email: detectedEmail || '',
          contact_name: dto.userName || '',
        },
      };
    }

    // 6. Format grounded response from top matching articles
    matchingArticles.sort((a, b) => b.content.length - a.content.length);
    const topArticles = matchingArticles.slice(0, 3);

    let compositeAnswer = '';
    const citations: string[] = [];

    for (const article of topArticles) {
      citations.push(`${article.title} (${article.category})`);
      compositeAnswer += `${article.content}\n\n`;
    }

    return {
      reply: compositeAnswer.trim(),
      citations,
      escalateSuggested: false,
    };
  }

  /**
   * Create support ticket (by tenant direct or AI on behalf)
   */
  async createTicket(dto: CreatePublicTicketDto) {
    if (!dto.subject || !dto.description || !dto.contact_email) {
      throw new BadRequestException('Subject, description, and contact email are required');
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.ticketRepo.count();
    const sequence = String(count + 1).padStart(4, '0');
    const ticketNumber = `TICK-${yearMonth}-${sequence}`;

    const ticket = this.ticketRepo.create({
      ticket_number: ticketNumber,
      subject: dto.subject,
      description: dto.description,
      contact_email: dto.contact_email,
      contact_name: dto.contact_name || dto.contact_email.split('@')[0],
      tenant_id: dto.tenant_id || undefined,
      category: dto.category || 'general',
      priority: dto.priority || 'medium',
      status: 'open',
      created_by_type: dto.created_by_type || 'tenant',
      ai_conversation_summary: dto.ai_conversation_summary || undefined,
    });

    const saved = await this.ticketRepo.save(ticket);
    return {
      success: true,
      ticket_number: saved.ticket_number,
      message: `Support ticket #${saved.ticket_number} created successfully.`,
      ticket: saved,
    };
  }

  /**
   * Get all published platform knowledge entries for user browsing
   */
  async getPublishedKnowledge(category?: string) {
    const qb = this.knowledgeRepo.createQueryBuilder('k')
      .where('k.is_published = :published', { published: true });

    if (category && category !== 'all') {
      qb.andWhere('k.category = :category', { category });
    }

    qb.orderBy('k.created_at', 'ASC');
    return qb.getMany();
  }

  /**
   * Track ticket status by ticket number & email
   */
  async trackTicket(ticketNumber: string, email: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { ticket_number: ticketNumber },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket #${ticketNumber} was not found`);
    }

    if (email && ticket.contact_email.toLowerCase() !== email.toLowerCase().trim()) {
      throw new BadRequestException('The email provided does not match the ticket record');
    }

    return {
      ticket_number: ticket.ticket_number,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      created_by_type: ticket.created_by_type,
      created_at: ticket.created_at,
      resolution_notes: ticket.resolution_notes || null,
      resolved_at: ticket.resolved_at || null,
    };
  }

  private extractEmail(text: string): string | null {
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : null;
  }

  private generateSubject(message: string, history?: any[]): string {
    const clean = message.replace(/[^\w\s]/gi, '').trim();
    if (clean.length <= 60) return clean || 'Platform Support Inquiry';
    return clean.slice(0, 57) + '...';
  }

  private detectCategory(lowerText: string): string {
    if (lowerText.includes('price') || lowerText.includes('cost') || lowerText.includes('billing') || lowerText.includes('subscription')) {
      return 'billing';
    }
    if (lowerText.includes('bug') || lowerText.includes('error') || lowerText.includes('crash') || lowerText.includes('api')) {
      return 'technical';
    }
    if (lowerText.includes('register') || lowerText.includes('login') || lowerText.includes('setup') || lowerText.includes('start')) {
      return 'onboarding';
    }
    if (lowerText.includes('security') || lowerText.includes('gdpr') || lowerText.includes('compliance') || lowerText.includes('data')) {
      return 'compliance';
    }
    return 'feature_inquiry';
  }

  private buildSummary(currentMessage: string, history?: any[]): string {
    if (!history || history.length === 0) return currentMessage;
    const lines = history.slice(-4).map(h => `${h.role === 'user' ? 'User' : 'AI'}: ${h.content}`);
    lines.push(`User: ${currentMessage}`);
    return lines.join('\n');
  }
}
