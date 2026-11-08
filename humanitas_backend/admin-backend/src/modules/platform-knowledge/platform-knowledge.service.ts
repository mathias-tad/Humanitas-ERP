import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { PlatformKnowledge } from './entities/platform-knowledge.entity';
import { CreatePlatformKnowledgeDto, UpdatePlatformKnowledgeDto } from './dto/platform-knowledge.dto';

@Injectable()
export class PlatformKnowledgeService {
  constructor(
    @InjectRepository(PlatformKnowledge)
    private readonly knowledgeRepo: Repository<PlatformKnowledge>,
  ) {}

  async findAll(category?: string, search?: string) {
    const qb = this.knowledgeRepo.createQueryBuilder('k');

    if (category && category !== 'all') {
      qb.andWhere('k.category = :category', { category });
    }

    if (search) {
      qb.andWhere(
        '(k.title ILIKE :search OR k.content ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    qb.orderBy('k.created_at', 'DESC');
    return qb.getMany();
  }

  async findPublished(category?: string) {
    const qb = this.knowledgeRepo.createQueryBuilder('k')
      .where('k.is_published = :published', { published: true });

    if (category && category !== 'all') {
      qb.andWhere('k.category = :category', { category });
    }

    qb.orderBy('k.created_at', 'ASC');
    return qb.getMany();
  }

  async findOne(id: string) {
    const item = await this.knowledgeRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Knowledge entry ${id} not found`);
    }
    return item;
  }

  async create(dto: CreatePlatformKnowledgeDto) {
    const item = this.knowledgeRepo.create({
      category: dto.category || 'general',
      title: dto.title,
      content: dto.content,
      tags: dto.tags || [],
      is_published: dto.is_published !== undefined ? dto.is_published : true,
      metadata: dto.metadata || {},
    });
    return this.knowledgeRepo.save(item);
  }

  async update(id: string, dto: UpdatePlatformKnowledgeDto) {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.knowledgeRepo.save(item);
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    await this.knowledgeRepo.remove(item);
    return { success: true, message: `Knowledge entry ${id} deleted` };
  }

  async seedDefaults() {
    const existing = await this.knowledgeRepo.count();
    if (existing > 0) {
      return { message: 'Platform knowledge already initialized', count: existing };
    }

    const defaultEntries: Partial<PlatformKnowledge>[] = [
      {
        category: 'saas_provider',
        title: 'SaaS Platform Provider & Corporate Profile',
        content: `**Humanitas Cloud Enterprise Technologies Inc.** is an enterprise-grade cloud operating system provider delivering modern Human Capital Management (HRMS) and comprehensive Cloud ERP.
- **Provider Identity**: Humanitas Cloud Enterprise Technologies Inc.
- **Support & Hotline**: support@humanitas.ziontech.tech | +1 (800) 555-HUMANITAS
- **SLA Commitment**: 99.99% guaranteed uptime backed by high-availability PostgreSQL clusters and redundant cloud infrastructure.
- **Headquarters**: Silicon Valley, CA with regional EMEA & African support hubs in Addis Ababa, Nairobi, and Dubai.
- **Operating Philosophy**: Mission-critical zero-coupling modular independence with multi-tenant data isolation.`,
        tags: ['provider', 'sla', 'contact', 'headquarters'],
        is_published: true,
      },
      {
        category: 'security_compliance',
        title: 'Enterprise Security, Multi-Tenancy & Data Isolation',
        content: `Humanitas enforces **Physical & Logical Database Isolation per Tenant**:
1. **Dedicated Database Provisioning**: Every tenant has an isolated PostgreSQL database dynamically provisioned via \`TenantMigrationService\`. Tenant data is never co-mingled in shared operational tables.
2. **Zero-Trust Access Control**: 100% of API endpoints are protected by JwtAuthGuard, ModuleSubscriptionGuard, and granular PermissionsGuard.
3. **Data Scoping Hierarchy**: Strict 4-tier hierarchy: Tenant -> Company -> Branch -> Department. Users without enterprise-wide permissions cannot access other branches or companies.
4. **Data Protection**: AES-256 encrypted at rest, TLS 1.3 in transit, and continuous daily automated backup snapshots.`,
        tags: ['security', 'compliance', 'isolation', 'database', 'gdpr'],
        is_published: true,
      },
      {
        category: 'pricing_plans',
        title: 'Subscription Packages, 14-Day Trial & Flexible Billing',
        content: `Humanitas offers flexible subscription packages tailored for SMEs up to multinational conglomerates:
- **14-Day Free Enterprise Trial**: Instant automated provisioning with no credit card required. Includes pre-seeded chart of accounts, master roles, and company structure.
- **Human Capital Suite (HRMS Only)**: Complete workforce directory, attendance & biometrics, shifts, leave accruals, recruitment ATS, and automated payroll.
- **Enterprise ERP Complete Suite**: Includes HRMS plus Multi-Warehouse Inventory (FIFO/AVCO), Products/Catalog with QR labels, Purchasing (3-way match), Sales & CRM (ZATCA e-invoicing), Offline POS checkout, and Double-Entry Financial Accounting.
- **AI Intelligence Add-On**: Tiered AI capabilities: \`ai.help\` (contextual assistant), \`ai.documents\` (PDF/DOCX studio), \`ai.actions\` (autonomous execution), and \`ai.full\`.`,
        tags: ['pricing', 'trial', 'packages', 'billing'],
        is_published: true,
      },
      {
        category: 'system_features',
        title: 'HRMS & Talent Management Engine',
        content: `The Human Capital Management (HRMS) module in Humanitas includes:
- **Employee Lifecycle**: Digital employee profiles, contracts, compensation history, and dynamic organizational hierarchy chart.
- **Attendance & Biometrics**: Hardware integration with ZKTeco and Hikvision biometric devices, plus mobile geofenced & QR code clock-in with anti-spoofing. Cursor-based pagination scales effortlessly across 100,000+ employees.
- **Leave Management**: Configurable leave policies (annual, sick, maternity, compassionate), automated accruals, and multi-tier approval chains.
- **Recruitment & ATS**: Career portal, Kanban candidate pipeline, resume storage, and 1-click candidate-to-employee profile conversion.
- **Workforce Management**: Voluntary Extra Time (VET) and Voluntary Time Off (VTO) shift bidding.`,
        tags: ['hrms', 'attendance', 'payroll', 'biometrics', 'recruitment'],
        is_published: true,
      },
      {
        category: 'system_features',
        title: 'Python Calculation Engine & Payroll Processing',
        content: `Humanitas delegates **ALL heavy computational arithmetic** to a high-speed Python Calculation Engine (FastAPI & Celery):
- **Progressive Tax & Statutory Deductions**: Computes complex income tax brackets, pension deductions, housing allowances, loan amortizations, and per diem claims without round-off discrepancies.
- **Inventory Valuation**: High-throughput FIFO and AVCO cost queues for warehouse stock.
- **Ledger Rollups**: Real-time double-entry trial balance, balance sheet, and P&L aggregations.
- **Document Rendering**: High-fidelity PDF rendering via WeasyPrint and DOCX generation via python-docx.`,
        tags: ['python', 'payroll', 'calculation', 'tax', 'fifo'],
        is_published: true,
      },
      {
        category: 'system_features',
        title: 'Enterprise ERP Modules: Inventory, Sales, POS & Accounting',
        content: `For full ERP tenants, Humanitas provides seamless operational commerce:
- **Multi-Warehouse Inventory**: Bin/shelf location tracking, internal stock transfers, stock adjustments, batch/lot tracking, and low-stock alerts.
- **Purchasing & Vendors**: Vendor RFQ comparison, Purchase Orders, Goods Receipt Notes (GRN), and 3-way invoice matching.
- **Sales & CRM**: Leads, quotations, sales orders, delivery dispatches, and compliant electronic invoices.
- **Point of Sale (POS)**: Super-fast cashier POS with offline caching, thermal receipt printing, shift register closing, and cash drawer management.
- **Financial Accounting**: Multi-currency chart of accounts, manual & automated journal vouchers, customer/vendor ledgers, and automated period closings.`,
        tags: ['inventory', 'purchasing', 'sales', 'pos', 'accounting'],
        is_published: true,
      },
      {
        category: 'onboarding_faq',
        title: 'How to Register as a New Tenant',
        content: `Registering a new company or organization on Humanitas takes less than 2 minutes:
1. Click the **"Start Free Trial"** button on the landing page navigation.
2. Enter your company name, admin email, secure password, and desired tenant subdomain slug.
3. Select your primary modules (HRMS or Full ERP) and preferred base currency.
4. The system provisions your isolated PostgreSQL database in seconds.
5. Log in immediately to access your Enterprise Dashboard with guided onboarding wizards.`,
        tags: ['onboarding', 'registration', 'setup', 'get_started'],
        is_published: true,
      },
      {
        category: 'saas_provider',
        title: 'Human Support Center & Ticket Escalation Process',
        content: `When a question or issue cannot be resolved by the automated AI platform assistant:
- Prospective and existing tenants can **create a support ticket** directly or have the AI draft and submit a ticket on their behalf.
- Every ticket is assigned a unique tracking number (\`TICK-YYYYMM-XXXX\`).
- Human platform support specialists review tickets with defined SLA priority (Urgent tickets responded to within 1 hour; standard tickets within 4 hours).
- Tenant Admins can track resolution progress in real-time.`,
        tags: ['support', 'tickets', 'escalation', 'sla'],
        is_published: true,
      },
    ];

    const saved = await this.knowledgeRepo.save(
      defaultEntries.map(e => this.knowledgeRepo.create(e))
    );
    return { message: 'Platform knowledge seeded successfully', count: saved.length };
  }
}
