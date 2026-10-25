import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { randomUUID } from 'crypto';
import {
  CreateAssetCategoryDto,
  CreateAssetDto,
  UpdateAssetDto,
  AssignAssetDto,
  ReturnAssetDto,
  CreateMaintenanceLogDto,
  AssetStatus,
  AssetCondition,
} from './dto/hrms-assets.dto';

@Injectable()
export class HrmsAssetsService {
  private readonly logger = new Logger(HrmsAssetsService.name);
  private readonly ensuredTenants = new Set<string>();

  constructor(private readonly databaseService: DatabaseService) {}

  private async getConnection(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    if (!this.ensuredTenants.has(tenantId)) {
      await this.ensureTables(connection);
      this.ensuredTenants.add(tenantId);
    }
    return connection;
  }

  private async ensureTables(connection: any) {
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS asset_categories (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          code VARCHAR(50),
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS company_assets (
          id VARCHAR(36) PRIMARY KEY,
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          category_id VARCHAR(36) NOT NULL,
          name VARCHAR(255) NOT NULL,
          model VARCHAR(150),
          serial_number VARCHAR(100),
          asset_tag VARCHAR(100) NOT NULL,
          qr_code_data TEXT,
          status VARCHAR(50) DEFAULT 'available',
          current_condition VARCHAR(50) DEFAULT 'good',
          purchase_cost DECIMAL(12, 2) DEFAULT 0.00,
          purchase_date DATE,
          warranty_expiry DATE,
          location VARCHAR(150),
          notes TEXT,
          current_assigned_user_id VARCHAR(36),
          created_by VARCHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS asset_assignments (
          id VARCHAR(36) PRIMARY KEY,
          asset_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          assigned_by VARCHAR(36),
          assigned_date DATE NOT NULL,
          expected_return_date DATE,
          returned_date DATE,
          received_by VARCHAR(36),
          return_condition VARCHAR(50),
          is_active BOOLEAN DEFAULT TRUE,
          acknowledged_at TIMESTAMP NULL,
          acknowledgment_signature TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS asset_maintenance_logs (
          id VARCHAR(36) PRIMARY KEY,
          asset_id VARCHAR(36) NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          cost DECIMAL(10, 2) DEFAULT 0.00,
          service_provider VARCHAR(150),
          service_date DATE NOT NULL,
          next_service_date DATE,
          status VARCHAR(50) DEFAULT 'completed',
          logged_by VARCHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed default categories if empty
      const existing = await connection.query(`SELECT COUNT(*) as count FROM asset_categories`);
      const count = parseInt(existing[0]?.count || '0', 10);
      if (count === 0) {
        const defaults = [
          { id: randomUUID(), name: 'IT Equipment & Laptops', code: 'IT-EQ', description: 'Workstations, laptops, docks, and monitors' },
          { id: randomUUID(), name: 'Mobile Devices & Tablets', code: 'MOB-DEV', description: 'Smartphones, test devices, and tablets' },
          { id: randomUUID(), name: 'Vehicles & Fleet', code: 'VEH-FL', description: 'Company cars, vans, and transport vehicles' },
          { id: randomUUID(), name: 'Access Keys & Security Cards', code: 'ACC-SEC', description: 'RFID badges, server room keys, and tokens' },
          { id: randomUUID(), name: 'Office Furniture & Fixtures', code: 'OFF-FUR', description: 'Ergonomic chairs, desks, and podiums' },
          { id: randomUUID(), name: 'Tools, Uniforms & Safety Gear', code: 'TLS-SAF', description: 'Technical kits, uniforms, and PPE' },
        ];

        for (const cat of defaults) {
          await connection.query(
            `INSERT INTO asset_categories (id, name, code, description) VALUES (?, ?, ?, ?)`,
            [cat.id, cat.name, cat.code, cat.description]
          );
        }
      }
    } catch (err) {
      this.logger.error(`Error ensuring asset tables: ${err.message}`, err.stack);
    }
  }

  async getCategories(tenantId: string) {
    const conn = await this.getConnection(tenantId);
    return conn.query(`SELECT * FROM asset_categories ORDER BY name ASC`);
  }

  async createCategory(tenantId: string, dto: CreateAssetCategoryDto) {
    const conn = await this.getConnection(tenantId);
    const id = randomUUID();
    const code = dto.code || dto.name.substring(0, 3).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);
    await conn.query(
      `INSERT INTO asset_categories (id, name, code, description) VALUES (?, ?, ?, ?)`,
      [id, dto.name, code, dto.description || null]
    );
    const rows = await conn.query(`SELECT * FROM asset_categories WHERE id = ?`, [id]);
    return rows[0];
  }

  async getAssets(
    tenantId: string,
    filters?: { category_id?: string; status?: string; search?: string },
    companyId?: string,
    branchId?: string
  ) {
    const conn = await this.getConnection(tenantId);
    let query = `
      SELECT 
        a.*,
        c.name as category_name,
        c.code as category_code,
        u.first_name,
        u.last_name,
        u.email as assigned_user_email,
        u.department as assigned_user_department
      FROM company_assets a
      LEFT JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.current_assigned_user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (companyId) {
      query += ` AND (a.company_id = ? OR a.company_id IS NULL)`;
      params.push(companyId);
    }
    if (branchId) {
      query += ` AND (a.branch_id = ? OR a.branch_id IS NULL)`;
      params.push(branchId);
    }
    if (filters?.category_id && filters.category_id !== 'all') {
      query += ` AND a.category_id = ?`;
      params.push(filters.category_id);
    }
    if (filters?.status && filters.status !== 'all') {
      query += ` AND a.status = ?`;
      params.push(filters.status);
    }
    if (filters?.search) {
      query += ` AND (a.name LIKE ? OR a.asset_tag LIKE ? OR a.serial_number LIKE ? OR a.model LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY a.created_at DESC`;
    return conn.query(query, params);
  }

  async getAssetById(tenantId: string, id: string) {
    const conn = await this.getConnection(tenantId);
    const rows = await conn.query(
      `
      SELECT 
        a.*,
        c.name as category_name,
        c.code as category_code,
        u.first_name,
        u.last_name,
        u.email as assigned_user_email,
        u.department as assigned_user_department
      FROM company_assets a
      LEFT JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.current_assigned_user_id = u.id
      WHERE a.id = ?
    `,
      [id]
    );

    if (!rows || rows.length === 0) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }

    const asset = rows[0];
    const assignments = await conn.query(
      `
      SELECT aa.*, u.first_name, u.last_name, u.email, u.department
      FROM asset_assignments aa
      LEFT JOIN users u ON aa.user_id = u.id
      WHERE aa.asset_id = ?
      ORDER BY aa.assigned_date DESC
    `,
      [id]
    );

    const maintenance = await conn.query(
      `SELECT * FROM asset_maintenance_logs WHERE asset_id = ? ORDER BY service_date DESC`,
      [id]
    );

    return {
      ...asset,
      assignment_history: assignments,
      maintenance_logs: maintenance,
    };
  }

  async createAsset(
    tenantId: string,
    dto: CreateAssetDto,
    createdBy?: string,
    companyId?: string,
    branchId?: string
  ) {
    const conn = await this.getConnection(tenantId);
    const id = randomUUID();

    // Generate unique asset tag if not provided
    const now = new Date();
    const datePrefix = `AST-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const assetTag = dto.asset_tag || `${datePrefix}-${randomSuffix}`;
    const qrCodeData = JSON.stringify({ id, tag: assetTag, serial: dto.serial_number || '' });

    await conn.query(
      `
      INSERT INTO company_assets (
        id, company_id, branch_id, category_id, name, model, serial_number,
        asset_tag, qr_code_data, status, current_condition, purchase_cost,
        purchase_date, warranty_expiry, location, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        dto.company_id || companyId || null,
        dto.branch_id || branchId || null,
        dto.category_id,
        dto.name,
        dto.model || null,
        dto.serial_number || null,
        assetTag,
        qrCodeData,
        AssetStatus.AVAILABLE,
        dto.condition || AssetCondition.GOOD,
        dto.purchase_cost || 0.0,
        dto.purchase_date || null,
        dto.warranty_expiry || null,
        dto.location || null,
        dto.notes || null,
        createdBy || null,
      ]
    );

    return this.getAssetById(tenantId, id);
  }

  async updateAsset(tenantId: string, id: string, dto: UpdateAssetDto) {
    const conn = await this.getConnection(tenantId);
    const existing = await conn.query(`SELECT * FROM company_assets WHERE id = ?`, [id]);
    if (!existing || existing.length === 0) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (dto.name !== undefined) {
      updates.push('name = ?');
      params.push(dto.name);
    }
    if (dto.category_id !== undefined) {
      updates.push('category_id = ?');
      params.push(dto.category_id);
    }
    if (dto.model !== undefined) {
      updates.push('model = ?');
      params.push(dto.model);
    }
    if (dto.serial_number !== undefined) {
      updates.push('serial_number = ?');
      params.push(dto.serial_number);
    }
    if (dto.status !== undefined) {
      updates.push('status = ?');
      params.push(dto.status);
    }
    if (dto.condition !== undefined) {
      updates.push('current_condition = ?');
      params.push(dto.condition);
    }
    if (dto.purchase_cost !== undefined) {
      updates.push('purchase_cost = ?');
      params.push(dto.purchase_cost);
    }
    if (dto.purchase_date !== undefined) {
      updates.push('purchase_date = ?');
      params.push(dto.purchase_date);
    }
    if (dto.warranty_expiry !== undefined) {
      updates.push('warranty_expiry = ?');
      params.push(dto.warranty_expiry);
    }
    if (dto.location !== undefined) {
      updates.push('location = ?');
      params.push(dto.location);
    }
    if (dto.notes !== undefined) {
      updates.push('notes = ?');
      params.push(dto.notes);
    }

    if (updates.length > 0) {
      params.push(id);
      await conn.query(`UPDATE company_assets SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return this.getAssetById(tenantId, id);
  }

  async assignAsset(tenantId: string, assetId: string, dto: AssignAssetDto, assignedBy?: string) {
    const conn = await this.getConnection(tenantId);
    const assets = await conn.query(`SELECT * FROM company_assets WHERE id = ?`, [assetId]);
    if (!assets || assets.length === 0) {
      throw new NotFoundException(`Asset with ID ${assetId} not found`);
    }

    const asset = assets[0];
    if (asset.status === AssetStatus.ASSIGNED) {
      throw new BadRequestException(`Asset is already assigned. Please return it before re-assigning.`);
    }

    const assignmentId = randomUUID();
    const assignedDate = dto.assigned_date || new Date().toISOString().split('T')[0];

    // Deactivate previous active assignment if any
    await conn.query(
      `UPDATE asset_assignments SET is_active = FALSE WHERE asset_id = ? AND is_active = TRUE`,
      [assetId]
    );

    await conn.query(
      `
      INSERT INTO asset_assignments (
        id, asset_id, user_id, assigned_by, assigned_date, expected_return_date, is_active, notes
      ) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)
    `,
      [
        assignmentId,
        assetId,
        dto.user_id,
        assignedBy || null,
        assignedDate,
        dto.expected_return_date || null,
        dto.notes || null,
      ]
    );

    // Update asset status
    await conn.query(
      `UPDATE company_assets SET status = ?, current_assigned_user_id = ? WHERE id = ?`,
      [AssetStatus.ASSIGNED, dto.user_id, assetId]
    );

    return this.getAssetById(tenantId, assetId);
  }

  async returnAsset(tenantId: string, assetId: string, dto: ReturnAssetDto, receivedBy?: string) {
    const conn = await this.getConnection(tenantId);
    const assets = await conn.query(`SELECT * FROM company_assets WHERE id = ?`, [assetId]);
    if (!assets || assets.length === 0) {
      throw new NotFoundException(`Asset with ID ${assetId} not found`);
    }

    const returnedDate = dto.returned_date || new Date().toISOString().split('T')[0];
    const returnCondition = dto.return_condition || AssetCondition.GOOD;

    // Update active assignment
    await conn.query(
      `
      UPDATE asset_assignments
      SET is_active = FALSE, returned_date = ?, return_condition = ?, received_by = ?, notes = CONCAT(COALESCE(notes, ''), ' ', COALESCE(?, ''))
      WHERE asset_id = ? AND is_active = TRUE
    `,
      [returnedDate, returnCondition, receivedBy || null, dto.notes || '', assetId]
    );

    // Update asset
    const newStatus =
      returnCondition === AssetCondition.DAMAGED
        ? AssetStatus.REPAIR
        : returnCondition === AssetCondition.MISSING
        ? AssetStatus.LOST
        : AssetStatus.AVAILABLE;

    await conn.query(
      `
      UPDATE company_assets
      SET status = ?, current_condition = ?, current_assigned_user_id = NULL
      WHERE id = ?
    `,
      [newStatus, returnCondition, assetId]
    );

    return this.getAssetById(tenantId, assetId);
  }

  async getMyAssets(tenantId: string, userId: string) {
    const conn = await this.getConnection(tenantId);
    return conn.query(
      `
      SELECT 
        a.*,
        c.name as category_name,
        c.code as category_code,
        aa.id as assignment_id,
        aa.assigned_date,
        aa.expected_return_date,
        aa.acknowledged_at
      FROM company_assets a
      JOIN asset_assignments aa ON a.id = aa.asset_id AND aa.is_active = TRUE AND aa.user_id = ?
      LEFT JOIN asset_categories c ON a.category_id = c.id
      ORDER BY aa.assigned_date DESC
    `,
      [userId]
    );
  }

  async acknowledgeAsset(tenantId: string, assignmentId: string, userId: string) {
    const conn = await this.getConnection(tenantId);
    const now = new Date();
    await conn.query(
      `
      UPDATE asset_assignments
      SET acknowledged_at = ?
      WHERE id = ? AND user_id = ?
    `,
      [now, assignmentId, userId]
    );
    return { success: true, acknowledged_at: now };
  }

  async createMaintenanceLog(
    tenantId: string,
    assetId: string,
    dto: CreateMaintenanceLogDto,
    loggedBy?: string
  ) {
    const conn = await this.getConnection(tenantId);
    const id = randomUUID();
    const serviceDate = dto.service_date || new Date().toISOString().split('T')[0];

    await conn.query(
      `
      INSERT INTO asset_maintenance_logs (
        id, asset_id, title, description, cost, service_provider, service_date, next_service_date, status, logged_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        assetId,
        dto.title,
        dto.description || null,
        dto.cost || 0.0,
        dto.service_provider || null,
        serviceDate,
        dto.next_service_date || null,
        dto.status || 'completed',
        loggedBy || null,
      ]
    );

    return conn.query(`SELECT * FROM asset_maintenance_logs WHERE id = ?`, [id]).then((r) => r[0]);
  }

  async getMaintenanceLogs(tenantId: string, assetId?: string) {
    const conn = await this.getConnection(tenantId);
    let query = `
      SELECT ml.*, a.name as asset_name, a.asset_tag
      FROM asset_maintenance_logs ml
      JOIN company_assets a ON ml.asset_id = a.id
    `;
    const params: any[] = [];
    if (assetId) {
      query += ` WHERE ml.asset_id = ?`;
      params.push(assetId);
    }
    query += ` ORDER BY ml.service_date DESC`;
    return conn.query(query, params);
  }

  async deleteAsset(tenantId: string, id: string) {
    const conn = await this.getConnection(tenantId);
    await conn.query(`DELETE FROM asset_maintenance_logs WHERE asset_id = ?`, [id]);
    await conn.query(`DELETE FROM asset_assignments WHERE asset_id = ?`, [id]);
    await conn.query(`DELETE FROM company_assets WHERE id = ?`, [id]);
    return { success: true };
  }

  async getAssetAnalytics(tenantId: string, companyId?: string, branchId?: string) {
    const conn = await this.getConnection(tenantId);
    let filterClause = '';
    const params: any[] = [];

    if (companyId) {
      filterClause += ` AND (company_id = ? OR company_id IS NULL)`;
      params.push(companyId);
    }
    if (branchId) {
      filterClause += ` AND (branch_id = ? OR branch_id IS NULL)`;
      params.push(branchId);
    }

    const counts = await conn.query(
      `
      SELECT 
        COUNT(*) as total_assets,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_count,
        SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned_count,
        SUM(CASE WHEN status = 'maintenance' OR status = 'repair' THEN 1 ELSE 0 END) as maintenance_count,
        SUM(CASE WHEN status = 'retired' OR status = 'lost' THEN 1 ELSE 0 END) as retired_count,
        SUM(purchase_cost) as total_valuation
      FROM company_assets
      WHERE 1=1 ${filterClause}
    `,
      params
    );

    const categoryBreakdown = await conn.query(
      `
      SELECT 
        c.name as category_name,
        COUNT(a.id) as asset_count,
        SUM(a.purchase_cost) as total_cost
      FROM company_assets a
      JOIN asset_categories c ON a.category_id = c.id
      WHERE 1=1 ${filterClause}
      GROUP BY c.id, c.name
      ORDER BY asset_count DESC
    `,
      params
    );

    const conditionBreakdown = await conn.query(
      `
      SELECT 
        current_condition,
        COUNT(*) as count
      FROM company_assets
      WHERE 1=1 ${filterClause}
      GROUP BY current_condition
    `,
      params
    );

    const row = counts[0] || {};
    return {
      total_assets: parseInt(row.total_assets || '0', 10),
      available_count: parseInt(row.available_count || '0', 10),
      assigned_count: parseInt(row.assigned_count || '0', 10),
      maintenance_count: parseInt(row.maintenance_count || '0', 10),
      retired_count: parseInt(row.retired_count || '0', 10),
      total_valuation: parseFloat(row.total_valuation || '0'),
      category_breakdown: categoryBreakdown,
      condition_breakdown: conditionBreakdown,
    };
  }
}
