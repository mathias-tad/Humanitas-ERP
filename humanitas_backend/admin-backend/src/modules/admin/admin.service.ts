import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser, AdminRole } from '../user/entities/admin-user.entity';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

/** The admin performing an action (from the verified access token). */
export interface AdminActor {
  id: string;
  role: AdminRole;
}

/**
 * Who may manage admin accounts:
 * - super_admin: everything, but never lock out the last super admin or themselves.
 * - admin: create/manage admin and support accounts; never touch super_admin
 *   accounts, change their own role, or grant super_admin.
 * - support: may only edit their own name, phone, email and password.
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminRepository: Repository<AdminUser>,
  ) {}

  private isSuper(actor: AdminActor): boolean {
    return actor.role === AdminRole.SUPER_ADMIN;
  }

  /** Throws unless `actor` may manage (edit/activate/deactivate/delete) `target`. */
  private assertCanManage(actor: AdminActor, target: AdminUser, action: string): void {
    if (actor.role === AdminRole.SUPPORT) {
      throw new ForbiddenException(`Support accounts cannot ${action} admin accounts`);
    }
    if (target.role === AdminRole.SUPER_ADMIN && !this.isSuper(actor)) {
      throw new ForbiddenException(`Only super admins can ${action} super admin accounts`);
    }
  }

  private async assertNotLastActiveSuperAdmin(target: AdminUser, action: string): Promise<void> {
    if (target.role !== AdminRole.SUPER_ADMIN || !target.is_active) return;
    const activeSupers = await this.adminRepository.count({
      where: { role: AdminRole.SUPER_ADMIN, is_active: true },
    });
    if (activeSupers <= 1) {
      throw new BadRequestException(`Cannot ${action} the last active super admin`);
    }
  }

  async create(createAdminDto: CreateAdminDto, actor: AdminActor): Promise<AdminUser> {
    if (actor.role === AdminRole.SUPPORT) {
      throw new ForbiddenException('Support accounts cannot create admin accounts');
    }
    // Only super_admin can create other super_admins
    if (createAdminDto.role === AdminRole.SUPER_ADMIN && !this.isSuper(actor)) {
      throw new ForbiddenException('Only super admins can create other super admins');
    }

    const existing = await this.adminRepository.findOne({
      where: { email: createAdminDto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const password_hash = await bcrypt.hash(createAdminDto.password, saltRounds);

    const admin = this.adminRepository.create({
      ...createAdminDto,
      password_hash,
    });

    const saved = await this.adminRepository.save(admin);
    delete (saved as any).password_hash;
    delete (saved as any).refresh_token;
    return saved;
  }

  async findAll(params?: {
    search?: string;
    role?: AdminRole;
    is_active?: boolean;
  }): Promise<{ data: AdminUser[]; total: number }> {
    const { search, role, is_active } = params || {};

    const queryBuilder = this.adminRepository.createQueryBuilder('admin');

    if (search) {
      queryBuilder.andWhere(
        '(admin.full_name ILIKE :search OR admin.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (role) {
      queryBuilder.andWhere('admin.role = :role', { role });
    }

    if (is_active !== undefined) {
      queryBuilder.andWhere('admin.is_active = :is_active', { is_active });
    }

    queryBuilder.orderBy('admin.created_at', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    // Remove sensitive fields
    const sanitized = data.map((admin) => {
      delete (admin as any).password_hash;
      delete (admin as any).refresh_token;
      return admin;
    });

    return { data: sanitized, total };
  }

  async findOne(id: string): Promise<AdminUser> {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }
    delete (admin as any).password_hash;
    delete (admin as any).refresh_token;
    return admin;
  }

  async update(id: string, updateAdminDto: UpdateAdminDto, actor: AdminActor): Promise<AdminUser> {
    const admin = await this.adminRepository.findOne({ where: { id } });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const isSelf = admin.id === actor.id;
    const changesRole = updateAdminDto.role !== undefined && updateAdminDto.role !== admin.role;
    const changesActive = updateAdminDto.is_active !== undefined && updateAdminDto.is_active !== admin.is_active;

    if (!isSelf) {
      this.assertCanManage(actor, admin, 'edit');
    }
    if (changesRole) {
      if (isSelf) throw new ForbiddenException('You cannot change your own role');
      if (actor.role === AdminRole.SUPPORT) throw new ForbiddenException('Support accounts cannot change roles');
      if (updateAdminDto.role === AdminRole.SUPER_ADMIN && !this.isSuper(actor)) {
        throw new ForbiddenException('Only super admins can grant the super admin role');
      }
      await this.assertNotLastActiveSuperAdmin(admin, 'demote');
    }
    if (changesActive) {
      if (isSelf) throw new ForbiddenException('You cannot change your own active status');
      this.assertCanManage(actor, admin, updateAdminDto.is_active ? 'activate' : 'deactivate');
      if (!updateAdminDto.is_active) await this.assertNotLastActiveSuperAdmin(admin, 'deactivate');
    }
    if (changesRole || (changesActive && !updateAdminDto.is_active) || updateAdminDto.password) {
      (admin as any).refresh_token = null; // force a fresh login with the new rights
    }

    // Check email uniqueness if changing email
    if (updateAdminDto.email && updateAdminDto.email !== admin.email) {
      const existing = await this.adminRepository.findOne({
        where: { email: updateAdminDto.email },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    // Handle password change
    if (updateAdminDto.password) {
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
      (updateAdminDto as any).password_hash = await bcrypt.hash(
        updateAdminDto.password,
        saltRounds,
      );
      delete updateAdminDto.password;
    }

    Object.assign(admin, updateAdminDto);
    const saved = await this.adminRepository.save(admin);
    delete (saved as any).password_hash;
    delete (saved as any).refresh_token;
    return saved;
  }

  async remove(id: string, currentUser: AdminActor): Promise<void> {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Cannot delete yourself
    if (admin.id === currentUser.id) {
      throw new BadRequestException('Cannot delete yourself');
    }

    this.assertCanManage(currentUser, admin, 'delete');

    // Prevent deleting the last super admin
    if (admin.role === AdminRole.SUPER_ADMIN) {
      const superAdminCount = await this.adminRepository.count({
        where: { role: AdminRole.SUPER_ADMIN },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot delete the last super admin');
      }
    }

    await this.adminRepository.remove(admin);
  }

  async deactivate(id: string, currentUser: AdminActor): Promise<AdminUser> {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Cannot deactivate yourself
    if (admin.id === currentUser.id) {
      throw new BadRequestException('Cannot deactivate yourself');
    }

    this.assertCanManage(currentUser, admin, 'deactivate');
    await this.assertNotLastActiveSuperAdmin(admin, 'deactivate');

    admin.is_active = false;
    (admin as any).refresh_token = null; // end their session
    const saved = await this.adminRepository.save(admin);
    delete (saved as any).password_hash;
    delete (saved as any).refresh_token;
    return saved;
  }

  async activate(id: string, currentUser: AdminActor): Promise<AdminUser> {
    const admin = await this.adminRepository.findOne({ where: { id } });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    this.assertCanManage(currentUser, admin, 'activate');

    admin.is_active = true;
    const saved = await this.adminRepository.save(admin);
    delete (saved as any).password_hash;
    delete (saved as any).refresh_token;
    return saved;
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    by_role: Record<string, number>;
  }> {
    const total = await this.adminRepository.count();
    const active = await this.adminRepository.count({ where: { is_active: true } });
    const inactive = total - active;

    const roleStats = await this.adminRepository
      .createQueryBuilder('admin')
      .select('admin.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('admin.role')
      .getRawMany();

    const by_role = roleStats.reduce(
      (acc, { role, count }) => ({ ...acc, [role]: parseInt(count, 10) }),
      {},
    );

    return { total, active, inactive, by_role };
  }
}
