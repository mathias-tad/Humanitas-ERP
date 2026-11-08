import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { PlatformKnowledge } from './entities/platform-knowledge.entity';
import { SupportTicket } from './entities/support-ticket.entity';
import { LandingAiChatDto, CreatePublicTicketDto } from './dto/public-support.dto';


const BUILTIN_PLATFORM_KNOWLEDGE = [
  {
    category: 'attendance',
    title: 'Biometric Terminal ADMS, 5-Minute Debouncing & Offline Sync',
    content: `Humanitas features enterprise biometric time & attendance integration:
- **ADMS Device Integration**: Native HTTP push protocol for ZKTeco and Hikvision biometric terminals. Devices push attendance logs (ATTLOG) automatically.
- **5-Minute Cooldown Debounce**: Accidental double-taps on biometric terminals or mobile scanners within a 5-minute window are automatically ignored, preventing duplicate records.
- **Offline Hardware Retention**: Terminals buffer up to 50,000+ punches in local flash memory during network outages. When reconnected, punches sync chronologically (punch_time ASC) with idempotent deduplication (UNIQUE device_sn, pin, punch_time).
- **Historical Shift Reconciliation**: When delayed punches arrive for previous days already auto-closed at midnight, the system reopens the record, populates actual_out, and marks status as Present.
- **USB & CSV Backup**: Admins can export .dat, .txt, or .csv files from physical devices and import them via Time & Attendance -> [Import Offline Logs].`,
    tags: ['biometric', 'adms', 'attendance', 'debounce', 'offline_sync', 'zkteco', 'hikvision', 'usb'],
  },
  {
    category: 'attendance',
    title: 'Overnight Shifts, Shift Midpoint Detection & Midnight Auto-Close',
    content: `Shift management and overnight cross-midnight logic:
- **Overnight Shift Continuity**: Shifts spanning midnight (e.g. 21:00 Day D to 02:00 Day D+1) anchor seamlessly to the shift work date (Day D). Punches on Day D+1 within the exit window register as clock-outs for Day D rather than premature new clock-ins.
- **Shift Midpoint Algorithm**: Single punches are categorized algorithmically: punches before the shift midpoint are recorded as clock-in (flagging missed clock-out); punches after midpoint are recorded as clock-out (flagging missed clock-in).
- **Midnight Auto-Day Close**: Open day shifts automatically close at 00:00 (midnight) with strictly 0 overtime credited (overtime_hours = 0). Overnight shifts close at the 06:00 morning buffer with 0 OT.
- **Pre-Midnight Warnings**: Automated alerts at 23:15 notify employees that their shift will close, and alert managers with active employee rosters.`,
    tags: ['overnight', 'shifts', 'midpoint', 'auto_close', 'midnight', 'attendance'],
  },
  {
    category: 'attendance',
    title: 'Live Overtime Monitor, VET/VTO & Attendance Regularization',
    content: `Overtime governance and employee attendance corrections:
- **Live Overtime Monitor (/attendance/overtime-monitor)**: Supervisory dashboard tracking active workers past scheduled shift end times with WebSocket updates.
- **Force Clock-Out with Manager Decision**: When supervisors force-close overdue shifts, they are prompted: Approve & Grant Overtime Credit or Standard Shift Close (0 OT).
- **Voluntary Extra Time (VET) & VTO**: Overtime should never run as continuous endless shifts. Organizations use VET opportunities (/scheduling/opportunities) where employees clock out of regular shifts and clock in specifically to VET shifts, with 5m and 1m pre-shift end push reminders.
- **Attendance Regularization**: Employees can submit correction requests with reasons and adjusted times. Supervisors review and approve with 1-click inside Attendance Monitor, routed through immutable attendance_correction_logs.`,
    tags: ['overtime', 'vet', 'vto', 'regularization', 'force_clockout', 'attendance'],
  },
  {
    category: 'payroll',
    title: 'Automated Payroll & Python Calculation Engine',
    content: `Enterprise payroll calculation powered by Python FastAPI microservices:
- **Salary Components**: Multi-component structures with base pay, housing, transportation, allowances, and performance bonuses.
- **Statutory Taxes & Pensions**: Progressive tax brackets, social security, and pension contribution tiers calculated with mathematical precision.
- **Automated Deductions**: Loan repayments, salary advances, and disciplinary penalties deducted automatically.
- **Bulk Execution & Payslips**: One-click bulk monthly payroll processing, payslip PDF rendering via Python, and export files for direct bank transfers (ABA, NACHA, local CSV).`,
    tags: ['payroll', 'salary', 'taxes', 'pension', 'payslip', 'python', 'compensation'],
  },
  {
    category: 'scheduling',
    title: 'Shifts, Rotation Patterns & Rosters',
    content: `Comprehensive workforce scheduling:
- **Configurable Shifts**: Start/end times, grace periods, overnight shift flags, break durations, and color coding.
- **Rotation Weeks & Patterns**: Multi-week shift rotation patterns assigned to employees or departments.
- **Interactive Roster**: Drag-and-drop roster management with schedule overrides, day-off tracking, and conflict detection.`,
    tags: ['shifts', 'scheduling', 'roster', 'rotation', 'patterns'],
  },
  {
    category: 'erp_core',
    title: 'Multi-Warehouse Inventory & FIFO/AVCO Costing (ERP Only)',
    content: `Humanitas ERP Multi-Warehouse Inventory:
- **Stock Quants & Warehouses**: Real-time stock levels across multiple warehouses and storage bins.
- **Valuation Methods**: Accurate FIFO (First-In, First-Out) queues and AVCO (Average Cost) calculated via Python.
- **Barcodes & Tracking**: Barcode scanning, lot numbers, and serial number tracking with automated reorder level alerts.`,
    tags: ['inventory', 'warehouse', 'fifo', 'avco', 'stock', 'erp'],
  },
  {
    category: 'erp_core',
    title: 'Sales, CRM & ZATCA Phase 2 E-Invoicing (ERP Only)',
    content: `Enterprise Sales & E-Invoicing:
- **Sales Lifecycle**: Lead tracking, quotations, sales orders, delivery notes, and customer invoices.
- **ZATCA Compliance**: Phase 2 e-invoicing with cryptographic signatures, QR code generation, and UBL 2.1 XML compliance.
- **Point of Sale (POS)**: Fast retail checkout with offline caching, cash drawer management, and thermal printing.`,
    tags: ['sales', 'crm', 'invoicing', 'zatca', 'pos', 'erp'],
  },
  {
    category: 'erp_core',
    title: 'Double-Entry Accounting & Financial Reports (ERP Only)',
    content: `Enterprise Financial Accounting:
- **Double-Entry Ledger**: Chart of accounts, manual and automated journal entries, currency management.
- **Financial Statements**: Real-time Trial Balance, Balance Sheet, Profit & Loss (P&L), and Cash Flow.
- **Fixed Assets**: Asset depreciation schedules and ledger integration.`,
    tags: ['accounting', 'finance', 'ledger', 'balance_sheet', 'trial_balance', 'pnl', 'erp'],
  },
  {
    category: 'general',
    title: 'Free Trial Registration & Organization Setup',
    content: `Getting started with Humanitas:
- **1-Click Free Trial**: Sign up on the landing page with your company name, email, and password.
- **Instant Workspace**: Automatically provisions an isolated multi-tenant database and seeds standard HR & ERP workflows.
- **No Credit Card Required**: Test all features freely during the trial period.`,
    tags: ['trial', 'signup', 'registration', 'setup', 'onboarding'],
  },
];

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

    // 1. Natural Greetings & Pleasantries Handler (Never suggest tickets for "hi", "hello", etc.)
    const greetingsRegex = /^(hi|hello|hey|good\s+(morning|afternoon|evening|day)|greetings|howdy|sup|yo|start|menu)(\s+there|\s+ai|\s+bot)?[\s!.,?]*$/i;
    const isGreeting = greetingsRegex.test(lowerMessage) || ['hi', 'hello', 'hey', 'greetings', 'start', 'menu'].includes(lowerMessage);

    if (isGreeting) {
      return {
        reply: isHrmsOnly
          ? `👋 **Hello! Welcome to Humanitas.**

I am your **Humanitas HRMS & PMS AI Assistant**. How can I help you today?

You can ask me about:
- 📋 **Employee Directory & Lifecycle**: Onboarding, employee profiles, document vault
- ⏰ **Biometric & Attendance**: ADMS device sync, 5-minute cooldown debouncing, overnight shifts, missed punches
- 📅 **Shifts & Scheduling**: Rosters, rotation patterns, shifts, grace periods
- 🏖️ **Leave & Absence**: Annual leave, sick leave balances, multi-level approvals
- 💰 **Automated Payroll**: Salary components, tax bands, automated calculations, payslips
- 🚀 **Free Trial & Setup**: How to get started with your organization

What would you like to know?`
          : `👋 **Hello! Welcome to Humanitas ERP.**

I am your **Enterprise Platform Copilot**. How can I assist your business today?

You can ask me about:
- 👥 **HRMS & Payroll**: Biometrics, shifts, leave, candidate ATS, Python payroll
- 📦 **Inventory & Warehouse**: Multi-warehouse quant, FIFO/AVCO costing, stock alerts
- 🛒 **Purchasing & Vendors**: RFQs, purchase orders, 3-way matching
- 💼 **Sales & CRM**: Leads, quotations, delivery notes, ZATCA e-invoicing
- 💳 **Point of Sale (POS)**: Offline POS checkout, barcode scanning, thermal receipts
- 📊 **Financial Accounting**: General ledger, balance sheet, trial balance, P&L
- ⚡ **AI Copilots & Actions**: Autonomous actions, document generation

What would you like to explore?`,
        citations: ['Humanitas Platform Overview'],
        escalateSuggested: false,
      };
    }

    // 2. Platform Capabilities / "Who are you?" / "What can you do?" / "Help"
    const capabilityRegex = /^(who\s+are\s+you|what\s+can\s+you\s+do|what\s+do\s+you\s+do|tell\s+me\s+about\s+yourself|help(\s+me)?|what\s+is\s+humanitas)[\s!.,?]*$/i;
    if (capabilityRegex.test(lowerMessage) || lowerMessage === 'help' || lowerMessage === 'features') {
      return {
        reply: isHrmsOnly
          ? `🤖 **About Humanitas HRMS Assistant**

I am the grounded AI copilot for **Humanitas HR & Performance Management System**.

### What I Can Help You With:
1. **Biometrics & Punch Syncing**: How ZKTeco and Hikvision ADMS devices sync, 5-minute cooldown debouncing, overnight shift continuity, and offline buffer reconciliation.
2. **Shifts & Rosters**: Creating shift patterns, rotation weeks, grace periods, and pre-shift push notifications.
3. **Attendance Regularization**: Submitting and reviewing missed punch correction requests with full audit logs.
4. **Payroll & Taxes**: Calculating multi-tier salaries, income tax brackets, deductions, and Python math engine integration.
5. **Leave Policies**: Configurable accrual rules, leave balances, and multi-step approvals.
6. **Free Trial Registration**: Step-by-step guidance to sign up for your organization.

Ask me any question or type a keyword to get started!`
          : `🤖 **About Humanitas ERP Assistant**

I am the enterprise AI copilot for **Humanitas Cloud ERP**.

### Key Modules Covered:
1. **HRMS & Payroll**: Biometric punching, overnight shifts, leave, candidate recruitment, Python payroll calculations.
2. **Multi-Warehouse Inventory**: Stock quants, batch & serial tracking, FIFO/AVCO valuation, barcode lookup.
3. **Purchasing & Vendor Management**: RFQs, purchase orders, goods receipts, 3-way matching.
4. **Sales, CRM & E-Invoicing**: Leads, quotes, invoices, ZATCA phase 2 compliance.
5. **Point of Sale (POS)**: Offline-capable retail POS, session cash drawer, barcode scanning, thermal printing.
6. **Double-Entry Financial Accounting**: Chart of accounts, journal entries, trial balance, balance sheet, P&L.
7. **AI Platform Copilots**: Autonomous actions, document studio, knowledge RAG.

Ask me any question or ask for help with any specific module!`,
        citations: ['Humanitas Platform Capabilities'],
        escalateSuggested: false,
      };
    }

    // 3. HRMS Repo Guard: If user asks about ERP modules in HRMS, route to Humanitas ERP
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

    // 4. Check for explicit ticket escalation or human support request
    const escalationTriggers = [
      'human', 'agent', 'support ticket', 'create ticket', 'open ticket',
      'talk to a person', 'representative', 'customer service', 'help center',
      'complaint', 'file a ticket', 'contact sales', 'custom quote', 'custom deal',
      'enterprise contract', 'billing dispute'
    ];
    const isEscalationRequest = escalationTriggers.some(kw => lowerMessage.includes(kw));

    // 5. Check if user is confirming a ticket draft
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

    // 6. Search Knowledge Articles (Combines DB records + Built-in Knowledge)
    let publishedFromDb: PlatformKnowledge[] = [];
    try {
      publishedFromDb = await this.knowledgeRepo.find({
        where: { is_published: true },
      });
    } catch (_) {
      publishedFromDb = [];
    }

    // Pool of all searchable knowledge
    const knowledgePool: Array<{ title: string; category: string; content: string; tags: string[] }> = [
      ...publishedFromDb.map(p => ({
        title: p.title,
        category: p.category,
        content: p.content,
        tags: p.tags || [],
      })),
      ...BUILTIN_PLATFORM_KNOWLEDGE,
    ];

    // Enterprise acronyms to preserve during tokenization
    const enterpriseAcronyms = new Set(['hr', 'ot', 'ai', 'qr', 'po', 'gl', 'so', 'rfq', 'pos', 'pms', 'ats', 'vat', 'tax', 'sms', 'pin']);
    const stopWords = new Set(['the', 'and', 'for', 'with', 'can', 'how', 'does', 'what', 'tell', 'show', 'you', 'are', 'about', 'this', 'that', 'from', 'into']);

    const queryTokens = lowerMessage
      .replace(/[^\w\s]/gi, ' ')
      .split(/\s+/)
      .filter(t => (t.length > 2 || enterpriseAcronyms.has(t)) && !stopWords.has(t));

    const scoredArticles: Array<{ article: typeof knowledgePool[0]; score: number }> = [];

    for (const item of knowledgePool) {
      const itemTitle = item.title.toLowerCase();
      const itemContent = item.content.toLowerCase();
      const itemCategory = item.category.toLowerCase();
      const itemTags = (item.tags || []).map(t => t.toLowerCase()).join(' ');

      let matchScore = 0;

      for (const token of queryTokens) {
        if (itemTitle.includes(token)) matchScore += 5;
        if (itemTags.includes(token)) matchScore += 3;
        if (itemCategory.includes(token)) matchScore += 2;
        if (itemContent.includes(token)) matchScore += 1;
      }

      if (matchScore > 0) {
        scoredArticles.push({ article: item, score: matchScore });
      }
    }

    scoredArticles.sort((a, b) => b.score - a.score);

    // 7. Grounded Response Formulation
    if (scoredArticles.length > 0) {
      const topArticles = scoredArticles.slice(0, 2).map(s => s.article);
      let compositeAnswer = '';
      const citations: string[] = [];

      for (const article of topArticles) {
        citations.push(`${article.title} (${article.category})`);
        compositeAnswer += `### ${article.title}\n${article.content}\n\n`;
      }

      compositeAnswer += `\n💡 *Have more questions or need step-by-step assistance with this? Feel free to ask!*`;

      return {
        reply: compositeAnswer.trim(),
        citations,
        escalateSuggested: false,
      };
    }

    // 8. If empty query or non-substantive input
    if (queryTokens.length === 0) {
      return {
        reply: `I'd be glad to help! Please ask me about any specific feature or topic you'd like to explore:
- *"How does biometric punch debouncing work?"*
- *"How are overnight shifts handled?"*
- *"How is automated payroll computed?"*
- *"How do attendance regularization requests work?"*
- *"How can I start a free trial for my company?"*`,
        citations: ['Humanitas Help Assistant'],
        escalateSuggested: false,
      };
    }

    // 9. Substantive question with no match in documentation -> Offer human support ticket
    const detectedEmail = dto.userEmail || this.extractEmail(rawMessage);
    const draftSubject = this.generateSubject(rawMessage, dto.history);

    return {
      reply: isEscalationRequest
        ? `I'd be glad to connect you with our human platform support specialists!

Would you like me to submit a support ticket for our engineering and support specialists to contact you directly?`
        : `I could not find specific documentation answering that question in our official platform knowledge base. Per our **Strict Zero-Guessing Policy**, I never speculate or fabricate facts.

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
