import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../auth/entities/tenant.entity';

export interface OnboardingChecklist {
  employeeId: string;
  employeeName: string;
  roleName: string;
  department: string;
  tasks: {
    day: number;
    title: string;
    description: string;
    completed: boolean;
  }[];
}

@Injectable()
export class AiOnboardingService {
  constructor(
    private databaseService: DatabaseService,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  /**
   * Generates a role-aware onboarding checklist for a new employee.
   * Called when a new user is created in the tenant system.
   */
  async generateOnboardingChecklist(
    tenantSlug: string,
    employeeId: string,
  ): Promise<OnboardingChecklist | null> {
    const tenant = await this.tenantRepository.findOne({ where: { slug: tenantSlug } });
    if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
    const connection = await this.databaseService.getTenantConnection(tenant.database_name);

    // Fetch new employee's details
    const userResult = await connection.query(
      `SELECT u.id, u.full_name, r.name as role_name, d.name as department_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`,
      [employeeId],
    );

    if (!userResult.length) {
      return null;
    }

    const emp = userResult[0];

    // Generate a smart, role-based checklist
    const baseTasks = [
      { day: 1, title: 'Complete personal information', description: 'Fill in your profile, emergency contacts, and bank details in the HR system.', completed: false },
      { day: 1, title: 'Read the employee handbook', description: 'Review the company policies, code of conduct, and leave policies.', completed: false },
      { day: 1, title: 'Set up your workstation and accounts', description: 'Ensure you have access to all required tools, email, and systems.', completed: false },
      { day: 7, title: 'Meet your team and direct manager', description: 'Schedule 1:1 introductions with key team members.', completed: false },
      { day: 7, title: 'Review your job description and KPIs', description: 'Confirm your role responsibilities and performance expectations with your manager.', completed: false },
      { day: 30, title: '30-day check-in with HR', description: 'Review your onboarding experience and raise any concerns.', completed: false },
      { day: 30, title: 'Complete mandatory training', description: 'Finish any required compliance or safety training modules.', completed: false },
      { day: 90, title: 'End of probation review', description: 'Participate in a formal performance review to conclude your probation period.', completed: false },
    ];

    // Add role-specific tasks
    if (emp.role_name?.toLowerCase().includes('manager') || emp.role_name?.toLowerCase().includes('hr')) {
      baseTasks.push({
        day: 7,
        title: 'Review team structure and reporting lines',
        description: 'Understand who reports to you and the current team dynamics.',
        completed: false,
      });
    }

    if (emp.role_name?.toLowerCase().includes('finance') || emp.role_name?.toLowerCase().includes('payroll')) {
      baseTasks.push({
        day: 7,
        title: 'Access financial systems and review controls',
        description: 'Get access to financial tools and review the approval authority matrix.',
        completed: false,
      });
    }

    return {
      employeeId: emp.id,
      employeeName: emp.full_name,
      roleName: emp.role_name,
      department: emp.department_name,
      tasks: baseTasks.sort((a, b) => a.day - b.day),
    };
  }
}
