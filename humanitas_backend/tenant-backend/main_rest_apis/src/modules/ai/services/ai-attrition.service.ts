import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../auth/entities/tenant.entity';

export interface AttritionRiskReport {
  employeeId: string;
  employeeName: string;
  department: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  signals: {
    signal: string;
    weight: number;
    detected: boolean;
  }[];
  recommendations: string[];
}

@Injectable()
export class AiAttritionService {
  constructor(
    private databaseService: DatabaseService,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  /**
   * Computes a flight risk score for all employees in a tenant.
   * Combines attendance trends, leave frequency, and tenure signals.
   */
  async computeFlightRiskForTenant(tenantSlug: string): Promise<AttritionRiskReport[]> {
    const tenant = await this.tenantRepository.findOne({ where: { slug: tenantSlug } });
    if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
    const connection = await this.databaseService.getTenantConnection(tenant.database_name);

    // Fetch employees with relevant signals
    const employees = await connection.query(`
      SELECT
        u.id,
        u.full_name,
        u.created_at as hire_date,
        d.name as department,
        COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'absent') as absent_count,
        COUNT(DISTINCT l.id) as leave_count,
        EXTRACT(MONTH FROM AGE(NOW(), u.created_at)) as tenure_months
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN attendances a ON a.user_id = u.id AND a.date > NOW() - INTERVAL '3 months'
      LEFT JOIN leaves l ON l.user_id = u.id AND l.created_at > NOW() - INTERVAL '3 months'
      WHERE u.is_active = true AND u.role NOT IN ('owner', 'admin')
      GROUP BY u.id, u.full_name, u.created_at, d.name
    `);

    return employees.map((emp: any) => {
      let riskScore = 0;

      const signals = [
        {
          signal: 'High absence rate (>3 absences in 3 months)',
          weight: 25,
          detected: Number(emp.absent_count) >= 3,
        },
        {
          signal: 'Frequent leave requests (>2 requests in 3 months)',
          weight: 20,
          detected: Number(emp.leave_count) > 2,
        },
        {
          signal: 'Very new employee (<3 months tenure)',
          weight: 15,
          detected: Number(emp.tenure_months) < 3,
        },
        {
          signal: 'Long tenure without progression (>36 months)',
          weight: 10,
          detected: Number(emp.tenure_months) > 36,
        },
      ];

      // Compute score
      for (const s of signals) {
        if (s.detected) riskScore += s.weight;
      }

      const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
        riskScore >= 60 ? 'critical' :
        riskScore >= 40 ? 'high' :
        riskScore >= 20 ? 'medium' : 'low';

      const recommendations: string[] = [];
      if (signals[0].detected) recommendations.push('Schedule a 1:1 wellness check-in');
      if (signals[1].detected) recommendations.push('Review workload and work-life balance');
      if (signals[2].detected) recommendations.push('Ensure strong onboarding support is in place');
      if (signals[3].detected) recommendations.push('Review compensation and career development opportunities');

      return {
        employeeId: emp.id,
        employeeName: emp.full_name,
        department: emp.department || 'Unassigned',
        riskScore,
        riskLevel,
        signals,
        recommendations,
      };
    });
  }
}
