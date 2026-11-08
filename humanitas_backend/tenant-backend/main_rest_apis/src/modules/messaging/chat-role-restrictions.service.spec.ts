import { Test, TestingModule } from '@nestjs/testing';
import { MessagingService } from './messaging.service';
import { DatabaseService } from '../database/database.service';
import { MessageEncryptionService } from './encryption/message-encryption.service';
import { MessagingGateway } from './messaging.gateway';
import { TenantUser } from '../auth/entities/tenant-user.entity';
import { ChatRoleRestriction } from './entities/chat-role-restriction.entity';
import { ChatDirectAccessGrant } from './entities/chat-direct-access-grant.entity';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('MessagingService - Role Restrictions & Access Grants', () => {
    let service: MessagingService;
    let mockDatabaseService: any;
    let mockEncryptionService: any;
    let mockGateway: any;
    let mockUserRepo: any;
    let mockRestrictionRepo: any;
    let mockGrantRepo: any;
    let mockConnection: any;

    const tenantId = 'test-tenant';
    const requesterId = 'user-req-1';
    const targetUserId = 'user-target-1';

    beforeEach(async () => {
        mockUserRepo = {
            findOne: jest.fn(),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        mockRestrictionRepo = {
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
            create: jest.fn().mockImplementation((r) => r),
        };

        mockGrantRepo = {
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn().mockImplementation((g) => Promise.resolve({ id: 'grant-123', ...g })),
            create: jest.fn().mockImplementation((g) => g),
            createQueryBuilder: jest.fn(),
        };

        mockConnection = {
            getRepository: jest.fn((entity) => {
                if (entity === TenantUser) return mockUserRepo;
                if (entity === ChatRoleRestriction) return mockRestrictionRepo;
                if (entity === ChatDirectAccessGrant) return mockGrantRepo;
                return {};
            }),
            query: jest.fn(),
        };

        mockDatabaseService = {
            getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
        };

        mockEncryptionService = {
            encrypt: jest.fn().mockReturnValue({ content: 'enc', iv: 'iv' }),
            decrypt: jest.fn().mockReturnValue('decrypted'),
        };

        mockGateway = {
            server: {
                to: jest.fn().mockReturnValue({ emit: jest.fn() }),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MessagingService,
                { provide: DatabaseService, useValue: mockDatabaseService },
                { provide: MessageEncryptionService, useValue: mockEncryptionService },
                { provide: MessagingGateway, useValue: mockGateway },
            ],
        }).compile();

        service = module.get<MessagingService>(MessagingService);
    });

    describe('checkDirectChatAccess', () => {
        it('allows user to chat with themselves', async () => {
            const res = await service.checkDirectChatAccess(tenantId, requesterId, requesterId);
            expect(res.canChat).toBe(true);
        });

        it('allows chat if target user has allow_direct_chat_override = true', async () => {
            mockUserRepo.findOne.mockResolvedValueOnce({
                id: targetUserId,
                role: 'hr_manager',
                full_name: 'HR Lead',
                allow_direct_chat_override: true,
            });

            const res = await service.checkDirectChatAccess(tenantId, requesterId, targetUserId);
            expect(res.canChat).toBe(true);
            expect(res.targetHasOverride).toBe(true);
        });

        it('allows chat if requester is admin or owner', async () => {
            mockUserRepo.findOne
                .mockResolvedValueOnce({ id: targetUserId, role: 'hr_manager', full_name: 'HR Lead', allow_direct_chat_override: false })
                .mockResolvedValueOnce({ id: requesterId, role: 'admin', full_name: 'System Admin' });

            const res = await service.checkDirectChatAccess(tenantId, requesterId, targetUserId);
            expect(res.canChat).toBe(true);
            expect(res.isRequesterAdmin).toBe(true);
        });

        it('allows chat if target user role is NOT restricted', async () => {
            mockUserRepo.findOne
                .mockResolvedValueOnce({ id: targetUserId, role: 'developer', full_name: 'Bob Dev', allow_direct_chat_override: false })
                .mockResolvedValueOnce({ id: requesterId, role: 'employee', full_name: 'Alice Employee' });
            mockRestrictionRepo.findOne.mockResolvedValueOnce(null);

            const res = await service.checkDirectChatAccess(tenantId, requesterId, targetUserId);
            expect(res.canChat).toBe(true);
        });

        it('blocks chat and returns triage prompt when target role is restricted and no grant exists', async () => {
            mockUserRepo.findOne
                .mockResolvedValueOnce({ id: targetUserId, role: 'hr_manager', full_name: 'Jane HR', allow_direct_chat_override: false })
                .mockResolvedValueOnce({ id: requesterId, role: 'employee', full_name: 'Alice Employee' });
            mockRestrictionRepo.findOne.mockResolvedValueOnce({
                role: 'hr_manager',
                is_restricted: true,
                triage_prompt: 'Please consult the AI Assistant for leave questions.',
            });

            const mockQb = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(null),
            };
            mockGrantRepo.createQueryBuilder.mockReturnValue(mockQb);
            mockGrantRepo.findOne.mockResolvedValueOnce(null);

            const res = await service.checkDirectChatAccess(tenantId, requesterId, targetUserId);
            expect(res.canChat).toBe(false);
            expect(res.isTargetRestricted).toBe(true);
            expect(res.triagePrompt).toContain('consult the AI Assistant');
        });

        it('allows chat if requester has an active approved grant', async () => {
            mockUserRepo.findOne
                .mockResolvedValueOnce({ id: targetUserId, role: 'hr_manager', full_name: 'Jane HR', allow_direct_chat_override: false })
                .mockResolvedValueOnce({ id: requesterId, role: 'employee', full_name: 'Alice Employee' });
            mockRestrictionRepo.findOne.mockResolvedValueOnce({
                role: 'hr_manager',
                is_restricted: true,
            });

            const mockQb = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue({
                    id: 'grant-active',
                    status: 'approved',
                    expires_at: null,
                    reason: 'Urgent contract matter',
                    updated_at: new Date(),
                }),
            };
            mockGrantRepo.createQueryBuilder.mockReturnValue(mockQb);

            const res = await service.checkDirectChatAccess(tenantId, requesterId, targetUserId);
            expect(res.canChat).toBe(true);
            expect(res.activeGrant).toBeDefined();
        });
    });

    describe('requestDirectChatAccess', () => {
        it('throws BadRequestException if requesting chat to self', async () => {
            await expect(service.requestDirectChatAccess(tenantId, requesterId, {
                targetUserId: requesterId,
                reason: 'Self message',
            })).rejects.toThrow(BadRequestException);
        });

        it('creates a new pending access grant', async () => {
            mockUserRepo.findOne.mockResolvedValueOnce({ id: targetUserId, full_name: 'Jane HR' });
            const mockQb = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(null),
            };
            mockGrantRepo.createQueryBuilder.mockReturnValue(mockQb);
            mockGrantRepo.findOne.mockResolvedValueOnce(null);

            const res = await service.requestDirectChatAccess(tenantId, requesterId, {
                targetUserId,
                reason: 'Need advice on maternity leave',
            });

            expect(res.message).toContain('Access request submitted');
            expect(mockGrantRepo.save).toHaveBeenCalled();
        });
    });

    describe('respondDirectChatAccess', () => {
        it('approves request with 24h duration', async () => {
            const existingGrant = {
                id: 'grant-123',
                requester_id: requesterId,
                target_user_id: targetUserId,
                status: 'pending',
                reason: 'Policy query',
            };
            mockGrantRepo.findOne.mockResolvedValueOnce(existingGrant);

            const res = await service.respondDirectChatAccess(tenantId, targetUserId, 'grant-123', {
                action: 'approve',
                duration: '24h',
                note: 'Approved for today',
            });

            expect(res.success).toBe(true);
            expect(res.status).toBe('approved');
            expect(res.expiresAt).toBeDefined();
        });

        it('approves request forever (indefinite duration)', async () => {
            const existingGrant = {
                id: 'grant-123',
                requester_id: requesterId,
                target_user_id: targetUserId,
                status: 'pending',
                reason: 'Key stakeholder',
            };
            mockGrantRepo.findOne.mockResolvedValueOnce(existingGrant);

            const res = await service.respondDirectChatAccess(tenantId, targetUserId, 'grant-123', {
                action: 'approve',
                duration: 'forever',
            });

            expect(res.success).toBe(true);
            expect(res.status).toBe('approved');
            expect(res.expiresAt).toBeNull();
        });

        it('rejects access request with note', async () => {
            const existingGrant = {
                id: 'grant-123',
                requester_id: requesterId,
                target_user_id: targetUserId,
                status: 'pending',
                reason: 'Irrelevant topic',
            };
            mockGrantRepo.findOne.mockResolvedValueOnce(existingGrant);

            const res = await service.respondDirectChatAccess(tenantId, targetUserId, 'grant-123', {
                action: 'reject',
                note: 'Please speak with your team lead first.',
            });

            expect(res.success).toBe(true);
            expect(res.status).toBe('rejected');
        });
    });

    describe('toggleDirectChatOverride', () => {
        it('toggles user override flag', async () => {
            const res = await service.toggleDirectChatOverride(tenantId, targetUserId, true);
            expect(res.success).toBe(true);
            expect(res.allow_direct_chat_override).toBe(true);
            expect(mockUserRepo.update).toHaveBeenCalledWith(targetUserId, { allow_direct_chat_override: true });
        });
    });
});
