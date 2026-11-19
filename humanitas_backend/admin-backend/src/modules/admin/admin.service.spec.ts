import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminService, AdminActor } from './admin.service';
import { AdminRole, AdminUser } from '../user/entities/admin-user.entity';

function admin(id: string, role: AdminRole, is_active = true): AdminUser {
  return { id, role, is_active, email: `${id}@x.test`, full_name: id, refresh_token: 'rt' } as unknown as AdminUser;
}

describe('AdminService authorization', () => {
  let store: Record<string, AdminUser>;
  let service: AdminService;
  const repo: any = {
    findOne: jest.fn(async ({ where }: any) => {
      if (where.id) return store[where.id] ? { ...store[where.id] } : null;
      return Object.values(store).find((a) => a.email === where.email) ?? null;
    }),
    count: jest.fn(async ({ where }: any) =>
      Object.values(store).filter((a) => a.role === where.role && (where.is_active === undefined || a.is_active === where.is_active)).length,
    ),
    save: jest.fn(async (a: AdminUser) => { store[a.id] = { ...a }; return { ...a }; }),
    create: jest.fn((a: any) => ({ id: 'new', ...a })),
    remove: jest.fn(async (a: AdminUser) => { delete store[a.id]; }),
  };

  const SUPER: AdminActor = { id: 'super1', role: AdminRole.SUPER_ADMIN };
  const ADMIN: AdminActor = { id: 'admin1', role: AdminRole.ADMIN };
  const SUPPORT: AdminActor = { id: 'support1', role: AdminRole.SUPPORT };

  beforeEach(() => {
    jest.clearAllMocks();
    store = {
      super1: admin('super1', AdminRole.SUPER_ADMIN),
      super2: admin('super2', AdminRole.SUPER_ADMIN),
      admin1: admin('admin1', AdminRole.ADMIN),
      admin2: admin('admin2', AdminRole.ADMIN),
      support1: admin('support1', AdminRole.SUPPORT),
    };
    service = new AdminService(repo);
  });

  describe('privilege escalation via update', () => {
    it('an admin cannot promote themselves', async () => {
      await expect(service.update('admin1', { role: AdminRole.SUPER_ADMIN }, ADMIN)).rejects.toThrow(ForbiddenException);
      expect(store.admin1.role).toBe(AdminRole.ADMIN);
    });

    it('support cannot promote themselves', async () => {
      await expect(service.update('support1', { role: AdminRole.ADMIN }, SUPPORT)).rejects.toThrow(ForbiddenException);
    });

    it('an admin cannot grant super_admin to someone else', async () => {
      await expect(service.update('admin2', { role: AdminRole.SUPER_ADMIN }, ADMIN)).rejects.toThrow(ForbiddenException);
    });

    it("an admin cannot change a super admin's password or email", async () => {
      await expect(service.update('super1', { password: 'new-password-123' }, ADMIN)).rejects.toThrow(ForbiddenException);
      await expect(service.update('super1', { email: 'evil@x.test' }, ADMIN)).rejects.toThrow(ForbiddenException);
    });

    it('support cannot edit other accounts', async () => {
      await expect(service.update('admin1', { full_name: 'x' }, SUPPORT)).rejects.toThrow(ForbiddenException);
    });

    it('is_active cannot be used to bypass deactivate rules', async () => {
      await expect(service.update('super1', { is_active: false }, ADMIN)).rejects.toThrow(ForbiddenException);
      await expect(service.update('admin1', { is_active: false }, ADMIN)).rejects.toThrow(ForbiddenException); // self
    });
  });

  describe('allowed changes', () => {
    it('anyone can edit their own profile and password', async () => {
      await expect(service.update('support1', { full_name: 'New Name', password: 'another-pass-1' }, SUPPORT)).resolves.toMatchObject({ full_name: 'New Name' });
    });

    it('an admin can manage support and admin accounts', async () => {
      await expect(service.update('support1', { role: AdminRole.ADMIN }, ADMIN)).resolves.toMatchObject({ role: AdminRole.ADMIN });
      await expect(service.deactivate('admin2', ADMIN)).resolves.toMatchObject({ is_active: false });
    });

    it('a super admin can promote and demote', async () => {
      await expect(service.update('admin1', { role: AdminRole.SUPER_ADMIN }, SUPER)).resolves.toMatchObject({ role: AdminRole.SUPER_ADMIN });
      await expect(service.update('super2', { role: AdminRole.ADMIN }, SUPER)).resolves.toMatchObject({ role: AdminRole.ADMIN });
    });

    it('a role change or password change ends the target session', async () => {
      await service.update('admin2', { role: AdminRole.SUPPORT }, SUPER);
      expect(store.admin2.refresh_token).toBeNull();
      store.support1.refresh_token = 'rt';
      await service.update('support1', { password: 'changed-pass-9' }, SUPPORT);
      expect(store.support1.refresh_token).toBeNull();
    });
  });

  describe('last super admin and self protection', () => {
    it('cannot demote or deactivate the last active super admin', async () => {
      delete (store as any).super2;
      await expect(service.update('super1', { role: AdminRole.ADMIN }, { id: 'other', role: AdminRole.SUPER_ADMIN })).rejects.toThrow(BadRequestException);
      await expect(service.deactivate('super1', { id: 'other', role: AdminRole.SUPER_ADMIN })).rejects.toThrow(BadRequestException);
    });

    it('cannot change your own role', async () => {
      await expect(service.update('super1', { role: AdminRole.ADMIN }, SUPER)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('activate / deactivate / delete / create', () => {
    it('only super admins can (re)activate a super admin', async () => {
      store.super2.is_active = false;
      await expect(service.activate('super2', ADMIN)).rejects.toThrow(ForbiddenException);
      await expect(service.activate('super2', SUPER)).resolves.toMatchObject({ is_active: true });
    });

    it('support cannot activate, deactivate, delete or create admins', async () => {
      store.admin2.is_active = false;
      await expect(service.activate('admin2', SUPPORT)).rejects.toThrow(ForbiddenException);
      await expect(service.deactivate('admin1', SUPPORT)).rejects.toThrow(ForbiddenException);
      await expect(service.remove('admin1', SUPPORT)).rejects.toThrow(ForbiddenException);
      await expect(service.create({ email: 'n@x.test', password: 'password-123', full_name: 'N' } as any, SUPPORT)).rejects.toThrow(ForbiddenException);
    });

    it('deactivation ends the target session', async () => {
      await service.deactivate('admin2', SUPER);
      expect(store.admin2.refresh_token).toBeNull();
    });

    it('an admin cannot delete a super admin', async () => {
      await expect(service.remove('super2', ADMIN)).rejects.toThrow(ForbiddenException);
    });

    it('an admin cannot create a super admin', async () => {
      await expect(
        service.create({ email: 'n@x.test', password: 'password-123', full_name: 'N', role: AdminRole.SUPER_ADMIN } as any, ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
