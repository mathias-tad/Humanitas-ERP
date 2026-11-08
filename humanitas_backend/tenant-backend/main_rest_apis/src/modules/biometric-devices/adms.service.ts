import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BiometricDevicesService } from './biometric-devices.service';
import { DatabaseService } from '../database/database.service';
import { AttendanceGateway } from '../attendance/attendance.gateway';
import { AttendanceService } from '../attendance/attendance.service';

export interface ResolvedTenantInfo {
  tenantId: string;
  tenantSlug: string;
  databaseName: string;
}

@Injectable()
export class AdmsService {
  private readonly logger = new Logger(AdmsService.name);

  constructor(
    private readonly devicesService: BiometricDevicesService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly masterDataSource: DataSource,
    @Inject(forwardRef(() => AttendanceGateway))
    private readonly attendanceGateway: AttendanceGateway,
    @Inject(forwardRef(() => AttendanceService))
    private readonly attendanceService: AttendanceService,
  ) {}

  /**
   * Resolves tenant from request headers, host, query, or hardware serial registry.
   */
  async resolveTenant(req: any, sn?: string): Promise<ResolvedTenantInfo | null> {
    const headers = req.headers || {};
    const query = req.query || {};

    // 1. Direct explicit tenant headers (e.g. from Nginx reverse proxy)
    const slugHeader = (headers['x-tenant-slug'] || headers['tenant-slug'] || query['tenant_slug'] || query['tenant']) as string;
    if (slugHeader) {
      const tenant = await this.findTenantBySlugOrId(slugHeader);
      if (tenant) return tenant;
    }

    const idHeader = headers['x-tenant-id'] as string;
    if (idHeader) {
      const tenant = await this.findTenantBySlugOrId(idHeader);
      if (tenant) return tenant;
    }

    // 2. Parse subdomain from Host header
    // e.g. "acme.api.humanitas-erp.ziontech.tech" or "acme.api.humanitas.ziontech.tech:3001"
    const rawHost = (headers['host'] || req.hostname || '') as string;
    const hostname = rawHost.split(':')[0].toLowerCase();

    const baseDomain = (
      this.configService.get<string>('TENANT_API_DOMAIN') ||
      'api.humanitas-erp.ziontech.tech'
    ).toLowerCase();

    if (hostname.endsWith(`.${baseDomain}`)) {
      const extractedSlug = hostname.slice(0, -(baseDomain.length + 1));
      if (extractedSlug && extractedSlug !== 'api' && extractedSlug !== 'www') {
        const tenant = await this.findTenantBySlugOrId(extractedSlug);
        if (tenant) return tenant;
      }
    }

    // Also support local dev: e.g. "acme.localhost"
    if (hostname.endsWith('.localhost')) {
      const extractedSlug = hostname.slice(0, -('.localhost'.length));
      if (extractedSlug) {
        const tenant = await this.findTenantBySlugOrId(extractedSlug);
        if (tenant) return tenant;
      }
    }

    // 3. Fallback: Lookup tenant by device serial number from master device_registry
    if (sn) {
      const reg = await this.masterDataSource.query(
        `SELECT t.id, t.slug, t.database_name 
         FROM device_registry dr 
         JOIN tenants t ON dr.tenant_id = t.id 
         WHERE dr.serial_number = $1 AND t.is_active = true`,
        [sn],
      );
      if (reg && reg.length > 0) {
        return {
          tenantId: reg[0].id,
          tenantSlug: reg[0].slug,
          databaseName: reg[0].database_name,
        };
      }
    }

    return null;
  }

  private async findTenantBySlugOrId(identifier: string): Promise<ResolvedTenantInfo | null> {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const rows = await this.masterDataSource.query(
      isUUID
        ? `SELECT id, slug, database_name FROM tenants WHERE id = $1 AND is_active = true`
        : `SELECT id, slug, database_name FROM tenants WHERE slug = $1 AND is_active = true`,
      [identifier],
    );

    if (rows && rows.length > 0) {
      return {
        tenantId: rows[0].id,
        tenantSlug: rows[0].slug,
        databaseName: rows[0].database_name,
      };
    }
    return null;
  }

  /**
   * Handles initialization & handshake from ZKTeco ADMS device.
   * Path: /iclock/cdata?SN={sn}&options=all
   */
  async handleHandshake(
    sn: string,
    clientIp: string,
    tenantInfo: ResolvedTenantInfo | null,
    options?: string,
  ): Promise<string> {
    if (!sn) {
      this.logger.warn('ADMS handshake missing serial number');
      return 'FAIL';
    }

    if (!tenantInfo) {
      this.logger.warn(`ADMS Handshake attempt from SN: ${sn} could not resolve tenant`);
      return 'OK'; // Return OK to prevent device crash, but do not authorize
    }

    this.logger.log(`Device Handshake: SN=${sn}, Tenant=${tenantInfo.tenantSlug}, IP=${clientIp}`);

    // Self-register device if unknown, or update heartbeat if already registered
    const { device, isNew } = await this.devicesService.registerOrUpdateFromAdms(
      tenantInfo.tenantId,
      sn,
      clientIp,
    );

    if (isNew) {
      this.logger.log(`Device ${sn} auto-registered for tenant ${tenantInfo.tenantSlug} (Pending Authorization)`);
    }

    // Zero-trust gate: only return full ADMS configuration if authorized by an administrator
    if (!device.is_authorized) {
      this.logger.warn(`Device ${sn} connected but is pending authorization by admin`);
      return 'OK';
    }

    // Device is authorized — return full ADMS push parameters
    const serverTime = Math.floor(Date.now() / 1000);
    return `GET OPTION FROM: ${sn}
Stamp=${serverTime}
OpStamp=${serverTime}
PhotoStamp=${serverTime}
ErrorDelay=30
Delay=30
TransTimes=00:00;14:05
TransInterval=1
TransFlag=1111000000
Realtime=1
Encrypt=0`;
  }

  /**
   * Handles data pushed from device (ATTLOG, OPERLOG, etc.)
   * Path: /iclock/cdata?SN={sn}&table=ATTLOG
   */
  async receiveData(
    sn: string,
    table: string,
    body: string,
    clientIp: string,
    tenantInfo: ResolvedTenantInfo | null,
  ): Promise<string> {
    if (!sn || !tenantInfo) {
      this.logger.warn(`ADMS Data Push rejected: Unknown tenant or SN=${sn}`);
      return 'OK';
    }

    this.logger.log(`Received ${table} from ${sn} (Tenant: ${tenantInfo.tenantSlug})`);

    const connection = await this.databaseService.getTenantConnection(tenantInfo.databaseName);

    // Verify device in this tenant DB
    const devices = await connection.query(
      `SELECT * FROM biometric_devices WHERE tenant_id = $1 AND serial_number = $2`,
      [tenantInfo.tenantId, sn],
    );

    if (!devices || devices.length === 0) {
      this.logger.warn(`Device ${sn} not found in tenant DB`);
      return 'OK';
    }

    const device = devices[0];

    // Authorization Gate: Discard data if device is not authorized
    if (!device.is_authorized) {
      this.logger.warn(`Discarded ${table} from unauthorized device ${sn}`);
      return 'OK';
    }

    // Update device status and heartbeat
    await this.devicesService.updateDeviceStatus(tenantInfo.tenantId, device.id, {
      status: 'Online',
      last_sync_at: new Date(),
      last_heartbeat_at: new Date(),
      last_seen_ip: clientIp,
    });

    if (table === 'ATTLOG') {
      await this.processAttendanceLogs(tenantInfo, device, body, connection);
    } else if (
      table === 'BIODATA' ||
      table === 'TEMPLATEV10' ||
      table === 'FACETEMP' ||
      table === 'BIOPHOTO'
    ) {
      await this.processBiometricTemplates(tenantInfo, sn, table, body);
    } else if (table === 'USERINFO') {
      await this.processUserInfo(tenantInfo, body, connection);
    }

    return 'OK';
  }

  /**
   * Ingests parsed biometric punches into attendance_records.
   * Format: PIN \t Time \t Status \t VerifyMethod
   */
  private async processAttendanceLogs(
    tenantInfo: ResolvedTenantInfo,
    device: any,
    data: string,
    connection: any,
  ) {
    // 1. Check HR Settings: is 'biometric' accepted?
    const hrSettingsResult = await connection.query(
      `SELECT data FROM settings WHERE category = 'hr'`,
    );
    const parsedSettings = hrSettingsResult && hrSettingsResult.length > 0 && hrSettingsResult[0].data
      ? (typeof hrSettingsResult[0].data === 'string' ? JSON.parse(hrSettingsResult[0].data) : hrSettingsResult[0].data)
      : {};

    let allowedMethods = ['qr', 'biometric'];
    if (Array.isArray(parsedSettings.allowed_attendance_methods)) {
      allowedMethods = parsedSettings.allowed_attendance_methods;
    }

    if (!allowedMethods.includes('biometric')) {
      this.logger.warn(
        `Biometric attendance is disabled in HR settings for tenant ${tenantInfo.tenantSlug}. Ignoring punches.`,
      );
      return;
    }

    const verificationMode = parsedSettings.biometric_verification_mode || 'optional';
    const lines = data.split(/\r?\n/).filter((l) => l.trim().length > 0);
    this.logger.log(`Received ${lines.length} punches from device ${device.serial_number}`);

    const validPunches: any[] = [];

    for (const line of lines) {
      const parts = line.split('\t').map((p) => p.trim());
      if (parts.length < 2) continue;

      const pin = parts[0];
      const punchTimeStr = parts[1];
      const punchDateTime = new Date(punchTimeStr);
      if (isNaN(punchDateTime.getTime())) continue;

      // Find user matching PIN
      let userId: string | null = null;

      // A) Check device_users mapping
      const mapped = await connection.query(
        `SELECT user_id FROM device_users 
         WHERE device_id = $1 AND (enrollment_number = $2 OR device_user_id = $2) AND is_active = true LIMIT 1`,
        [device.id, pin],
      );

      if (mapped && mapped.length > 0) {
        userId = mapped[0].user_id;
      } else {
        // B) Check users table by ID, email, or phone
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pin);
        const users = await connection.query(
          isUUID
            ? `SELECT id FROM users WHERE id = $1 AND is_active = true LIMIT 1`
            : `SELECT id FROM users WHERE (email = $1 OR phone = $1) AND is_active = true LIMIT 1`,
          [pin],
        );
        if (users && users.length > 0) {
          userId = users[0].id;
        }
      }

      if (!userId) {
        this.logger.debug(`User with PIN "${pin}" not recognized in tenant DB`);
        continue;
      }

      // Check Verification Mode policy:
      if (verificationMode === 'strict_finger_face') {
        const userFlags = await connection.query(
          `SELECT has_fingerprint, has_face FROM users WHERE id = $1`,
          [userId],
        );
        if (!userFlags[0]?.has_fingerprint || !userFlags[0]?.has_face) {
          this.logger.warn(`Punch ignored for user ${userId}: strict finger+face required by company policy.`);
          continue;
        }
      } else if (verificationMode === 'strict_all') {
        const userFlags = await connection.query(
          `SELECT has_fingerprint, has_face, has_palm FROM users WHERE id = $1`,
          [userId],
        );
        if (!userFlags[0]?.has_fingerprint || !userFlags[0]?.has_face || !userFlags[0]?.has_palm) {
          this.logger.warn(`Punch ignored for user ${userId}: strict finger+face+palm required by company policy.`);
          continue;
        }
      }

      const isLagged = (Date.now() - punchDateTime.getTime()) > 15 * 60 * 1000;

      validPunches.push({
        userId,
        pin,
        deviceId: device.id,
        deviceSerialNumber: device.serial_number,
        punchTime: punchDateTime,
        verifyMethod: 'biometric_adms',
        rawPayload: line,
        companyId: device.company_id,
        branchId: device.branch_id,
        isOfflineSync: isLagged,
      });
    }

    if (validPunches.length === 0) {
      this.logger.log(`No valid recognized employee punches to ingest from ${device.serial_number}`);
      return;
    }

    const summary = await this.attendanceService.processBiometricPunchesBatch(
      tenantInfo.tenantId,
      validPunches,
    );

    this.logger.log(
      `ADMS Batch Complete for ${device.serial_number}: ${summary.total} total, ` +
      `${summary.processed} processed, ${summary.reconciled} reconciled, ` +
      `${summary.debounced} debounced, ${summary.duplicatesSkipped} duplicates skipped, ${summary.errors} errors.`,
    );
  }

  private async processBiometricTemplates(
    tenantInfo: ResolvedTenantInfo,
    sn: string,
    table: string,
    body: string,
  ) {
    const lines = body.split('\n').filter((l) => l.trim().length > 0);
    this.logger.log(`Processing ${lines.length} biometric template entries from device ${sn}`);

    for (const line of lines) {
      const parts = line.split('\t');
      const kv: Record<string, string> = {};
      for (const p of parts) {
        const eqIdx = p.indexOf('=');
        if (eqIdx !== -1) {
          const k = p.slice(0, eqIdx).trim().toUpperCase();
          const v = p.slice(eqIdx + 1).trim();
          kv[k] = v;
        }
      }

      const pin = kv['PIN'] || kv['USER_PIN'] || kv['ENROLLNUMBER'] || parts[0]?.trim();
      if (!pin) continue;

      let templateType: 'fingerprint' | 'face' | 'palm' = 'fingerprint';
      const typeNum = kv['TYPE'];
      if (typeNum === '2' || typeNum === '15' || table === 'FACETEMP') {
        templateType = 'face';
      } else if (typeNum === '9') {
        templateType = 'palm';
      } else {
        templateType = 'fingerprint';
      }

      const fid = kv['NO'] || kv['INDEX'] || kv['FID'] || kv['FINGERID'] || '0';
      const tmpData = kv['TMP'] || kv['DATA'] || kv['TEMPLATE'] || '';

      if (tmpData) {
        await this.devicesService.saveBiometricTemplate(
          tenantInfo.tenantId,
          sn,
          pin,
          fid,
          templateType,
          tmpData,
        );
      }
    }
  }

  /**
   * Processes user info push from device (e.g. card number assignment).
   */
  private async processUserInfo(
    tenantInfo: ResolvedTenantInfo,
    body: string,
    connection: any,
  ) {
    const lines = body.split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines) {
      const parts = line.split('\t');
      const kv: Record<string, string> = {};
      for (const p of parts) {
        const eqIdx = p.indexOf('=');
        if (eqIdx !== -1) {
          const k = p.slice(0, eqIdx).trim().toUpperCase();
          const v = p.slice(eqIdx + 1).trim();
          kv[k] = v;
        }
      }

      const pin = kv['PIN'] || kv['USER_PIN'] || kv['ENROLLNUMBER'];
      const cardNo = kv['CARDNO'] || kv['CARD'];

      if (pin && cardNo) {
        await connection.query(
          `UPDATE users SET card_number = $1 WHERE biometric_pin = $2`,
          [cardNo, pin],
        );
        await connection.query(
          `UPDATE device_users SET has_card = true WHERE enrollment_number = $1`,
          [pin],
        );
      }
    }
  }

  async getCommands(sn: string, tenantInfo: ResolvedTenantInfo | null): Promise<string> {
    if (!sn || !tenantInfo) return 'OK';
    return this.devicesService.getPendingCommands(tenantInfo.tenantId, sn);
  }

  async receiveCmdResult(sn: string, body: string, tenantInfo: ResolvedTenantInfo | null): Promise<string> {
    if (!sn || !tenantInfo) return 'OK';
    await this.devicesService.markCommandResult(tenantInfo.tenantId, sn, body);
    return 'OK';
  }
}
