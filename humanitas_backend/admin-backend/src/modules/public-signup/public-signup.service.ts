import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from '../settings/entities/settings.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { TenantService } from '../tenant/tenant.service';
import { MODULES } from '../module-catalog/module-catalog';
import { PublicSignupDto } from './dto/public-signup.dto';
import { SlidingWindowLimiter, slugProblem } from './signup-rules';

export interface SignupResult {
  company_name: string;
  slug: string;
  contact_email: string;
  trial_ends_at: Date | null;
  modules: string[];
}

@Injectable()
export class PublicSignupService {
  /** 3 sign-ups per visitor and 30 in total per hour: each sign-up creates a database. */
  private readonly perVisitor = new SlidingWindowLimiter(3, 60 * 60 * 1000);
  private readonly overall = new SlidingWindowLimiter(30, 60 * 60 * 1000);

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly settingsRepository: Repository<PlatformSettings>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly tenantService: TenantService,
  ) {}

  private settings(): Promise<PlatformSettings | null> {
    return this.settingsRepository.findOne({ where: {} });
  }

  /** What the sign-up page shows: whether sign-up is open, the trial length and every module. */
  async options() {
    const s = await this.settings();
    return {
      enabled: !!s?.self_signup_enabled,
      trial_days: s?.default_trial_days ?? 14,
      platform_name: s?.platform_name ?? 'Humanitas',
      support_email: s?.support_email ?? null,
      modules: MODULES.map(({ key, name, category, description, depends, status }) => ({
        key,
        name,
        category,
        description,
        depends,
        status,
      })),
    };
  }

  async slugAvailable(slug: string): Promise<{ available: boolean; reason?: string }> {
    const problem = slugProblem(slug);
    if (problem) return { available: false, reason: problem };
    const taken = await this.tenantRepository.findOne({ where: { slug: slug.trim() }, withDeleted: true });
    return taken ? { available: false, reason: 'This organization ID is already taken.' } : { available: true };
  }

  async signup(dto: PublicSignupDto, ip: string): Promise<SignupResult> {
    if (dto.website && dto.website.trim()) {
      throw new BadRequestException('The sign-up could not be completed.');
    }
    const s = await this.settings();
    if (!s?.self_signup_enabled) {
      throw new ForbiddenException('Online sign-up is closed right now. Contact us and we will set up your account.');
    }
    const problem = slugProblem(dto.slug);
    if (problem) throw new BadRequestException(problem);

    const available = new Set(MODULES.filter((m) => m.status === 'available').map((m) => m.key));
    const modules = Array.from(new Set(dto.modules.map((m) => String(m).toLowerCase().trim())));
    const notOffered = modules.filter((m) => !available.has(m));
    if (notOffered.length) {
      throw new BadRequestException(`These modules cannot be chosen yet: ${notOffered.join(', ')}.`);
    }
    if (!modules.length) throw new BadRequestException('Choose at least one module.');

    if (!this.perVisitor.hit(ip) || !this.overall.hit('*')) {
      throw new HttpException('Too many sign-ups. Please try again in an hour.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const count = await this.tenantRepository.count();
    if (s.max_tenants && count >= s.max_tenants) {
      throw new ForbiddenException('We are not taking new sign-ups right now. Contact us and we will set up your account.');
    }

    const slugTaken = await this.tenantRepository.findOne({ where: { slug: dto.slug }, withDeleted: true });
    if (slugTaken) throw new ConflictException('This organization ID is already taken.');

    const tenant = await this.tenantService.create({
      company_name: dto.company_name.trim(),
      slug: dto.slug.trim(),
      contact_email: dto.contact_email.trim().toLowerCase(),
      contact_phone: dto.contact_phone?.trim() || undefined,
      country: dto.country?.trim() || undefined,
      timezone: dto.timezone?.trim() || undefined,
      enabled_features: modules,
    });

    return {
      company_name: tenant.company_name,
      slug: tenant.slug,
      contact_email: tenant.contact_email,
      trial_ends_at: tenant.trial_ends_at ?? null,
      modules,
    };
  }
}
