import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { PlatformSettings } from './entities/settings.entity';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('SettingsService - SMTP Email Configuration & Test', () => {
  let service: SettingsService;

  const mockSettingsRepository = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve(entity)),
    query: jest.fn().mockResolvedValue([]),
  };

  const mockSendMail = jest.fn();
  const mockVerify = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      verify: mockVerify,
      sendMail: mockSendMail,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: getRepositoryToken(PlatformSettings),
          useValue: mockSettingsRepository,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEmailSettings', () => {
    it('should return email settings with masked password and new fields', async () => {
      mockSettingsRepository.findOne.mockResolvedValue({
        smtp_host: 'mail.ziontech.tech',
        smtp_port: 587,
        smtp_username: 'noreply@mybookingspot.com',
        smtp_password: 'supersecretpassword',
        from_email: 'noreply@mybookingspot.com',
        from_name: 'MyBookingSpot',
        smtp_secure: true,
      });

      const result = await service.getEmailSettings();

      expect(result).toEqual({
        smtp_host: 'mail.ziontech.tech',
        smtp_port: 587,
        smtp_username: 'noreply@mybookingspot.com',
        smtp_password: '********',
        from_email: 'noreply@mybookingspot.com',
        from_name: 'MyBookingSpot',
        smtp_secure: true,
      });
    });
  });

  describe('updateEmailSettings', () => {
    it('should not overwrite existing password when password is masked or empty', async () => {
      const existingSettings = {
        smtp_host: 'mail.ziontech.tech',
        smtp_port: 587,
        smtp_username: 'noreply@mybookingspot.com',
        smtp_password: 'existing_secure_password',
        from_email: 'noreply@mybookingspot.com',
        from_name: 'MyBookingSpot',
        smtp_secure: true,
      };
      mockSettingsRepository.findOne.mockResolvedValue(existingSettings);

      await service.updateEmailSettings({
        smtp_host: 'smtp.newhost.com',
        smtp_password: '********',
      });

      expect(existingSettings.smtp_password).toBe('existing_secure_password');
      expect(existingSettings.smtp_host).toBe('smtp.newhost.com');
      expect(mockSettingsRepository.save).toHaveBeenCalled();
    });

    it('should update password when a new non-empty password is provided', async () => {
      const existingSettings = {
        smtp_password: 'old_password',
      };
      mockSettingsRepository.findOne.mockResolvedValue(existingSettings);

      await service.updateEmailSettings({
        smtp_password: 'brand_new_password',
      });

      expect(existingSettings.smtp_password).toBe('brand_new_password');
      expect(mockSettingsRepository.save).toHaveBeenCalled();
    });
  });

  describe('testEmailConnection', () => {
    it('should fail if SMTP host is missing', async () => {
      mockSettingsRepository.findOne.mockResolvedValue({
        smtp_host: null,
        smtp_port: null,
      });

      const result = await service.testEmailConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('SMTP Host and Port must be configured');
    });

    it('should fail if credentials are missing', async () => {
      mockSettingsRepository.findOne.mockResolvedValue({
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        smtp_username: null,
        smtp_password: null,
      });

      const result = await service.testEmailConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('SMTP Username and Password must be configured');
    });

    it('should fail if recipient email is missing', async () => {
      mockSettingsRepository.findOne.mockResolvedValue({
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        smtp_username: 'user@example.com',
        smtp_password: 'pwd',
        from_email: null,
      });

      const result = await service.testEmailConnection({ to_email: '' });
      expect(result.success).toBe(false);
    });

    it('should successfully send test email to input email', async () => {
      mockSettingsRepository.findOne.mockResolvedValue({
        smtp_host: 'mail.ziontech.tech',
        smtp_port: 587,
        smtp_username: 'noreply@mybookingspot.com',
        smtp_password: 'secret_password',
        from_email: 'noreply@mybookingspot.com',
        from_name: 'MyBookingSpot',
        smtp_secure: true,
      });

      mockVerify.mockResolvedValue(true);
      mockSendMail.mockResolvedValue({ messageId: '<test-message-123@domain>' });

      const result = await service.testEmailConnection({
        to_email: 'recipient@test.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('recipient@test.com');
      expect(mockVerify).toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@test.com',
          from: '"MyBookingSpot" <noreply@mybookingspot.com>',
          subject: expect.stringContaining('SMTP Test Email'),
        }),
      );
    });

    it('should catch SMTP transport error and return failure message', async () => {
      mockSettingsRepository.findOne.mockResolvedValue({
        smtp_host: 'mail.ziontech.tech',
        smtp_port: 587,
        smtp_username: 'noreply@mybookingspot.com',
        smtp_password: 'wrong_password',
        from_email: 'noreply@mybookingspot.com',
      });

      mockVerify.mockRejectedValue(new Error('Invalid login credentials'));

      const result = await service.testEmailConnection({
        to_email: 'recipient@test.com',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid login credentials');
    });
  });
});
