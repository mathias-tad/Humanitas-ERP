import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser, AdminRole } from '../user/entities/admin-user.entity';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminRepository: Repository<AdminUser>,
  ) {}

  async create(createAdminDto: CreateAdminDto, currentUser: { role: AdminRole }): Promise<AdminUser> {
    // Only super_admin can create other super_admins
    if (createAdminDto.role === AdminRole.SUPER_ADMIN && currentUser.role !== AdminRole.SUPER_ADMIN) {
      throw new BadRequestException('Only super admins can create other super admins');
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

  async update(id: string, updateAdminDto: UpdateAdminDto): Promise<AdminUser> {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
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

  async remove(id: string, currentUser: { id: string; role: AdminRole }): Promise<void> {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Cannot delete yourself
    if (admin.id === currentUser.id) {
      throw new BadRequestException('Cannot delete yourself');
    }

    // Only super_admin can delete other super_admins
    if (admin.role === AdminRole.SUPER_ADMIN && currentUser.role !== AdminRole.SUPER_ADMIN) {
      throw new BadRequestException('Only super admins can delete other super admins');
    }

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

  async deactivate(id: string, currentUser: { id: string; role: AdminRole }): Promise<AdminUser> {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Cannot deactivate yourself
    if (admin.id === currentUser.id) {
      throw new BadRequestException('Cannot deactivate yourself');
    }

    // Only super_admin can deactivate other super_admins
    if (admin.role === AdminRole.SUPER_ADMIN && currentUser.role !== AdminRole.SUPER_ADMIN) {
      throw new BadRequestException('Only super admins can deactivate other super admins');
    }

    admin.is_active = false;
    const saved = await this.adminRepository.save(admin);
    delete (saved as any).password_hash;
    delete (saved as any).refresh_token;
    return saved;
  }

  async activate(id: string): Promise<AdminUser> {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

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
