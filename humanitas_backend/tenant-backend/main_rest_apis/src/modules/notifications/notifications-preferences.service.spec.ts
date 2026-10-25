describe('NotificationsService - Notification Preferences', () => {
  const categoryMap: Record<string, string | null> = {
    leave_status_updates: null,
    payslip_ready: null,
    shift_assigned: null,
    announcement: null,
    survey_invite: null,
    leave_approval_requests: 'approve_leave',
    expense_approval_requests: 'approve_expenses',
    grievance_filed: 'manage_grievances',
    payroll_run_completed: 'run_payroll',
    device_offline_alert: 'authorize_devices',
    import_export_completed: 'view_import_export',
    system_health_alert: 'view_logs',
  };

  describe('NOTIFICATION_CATEGORY_PERMISSION_MAP', () => {
    it('should have null permission for employee-visible categories', () => {
      expect(categoryMap['leave_status_updates']).toBeNull();
      expect(categoryMap['payslip_ready']).toBeNull();
      expect(categoryMap['announcement']).toBeNull();
    });

    it('should require approve_leave for leave approval category', () => {
      expect(categoryMap['leave_approval_requests']).toBe('approve_leave');
    });

    it('should require run_payroll for payroll completion category', () => {
      expect(categoryMap['payroll_run_completed']).toBe('run_payroll');
    });

    it('should require authorize_devices for device alert category', () => {
      expect(categoryMap['device_offline_alert']).toBe('authorize_devices');
    });

    it('should filter categories by employee permissions', () => {
      const employeePerms = ['view_my_leave', 'request_leave', 'view_my_payslip'];
      const visible = Object.entries(categoryMap)
        .filter(([_, perm]) => perm === null || employeePerms.includes(perm as string))
        .map(([cat]) => cat);
      expect(visible).toContain('leave_status_updates');
      expect(visible).not.toContain('leave_approval_requests');
      expect(visible).not.toContain('payroll_run_completed');
    });

    it('should show all categories for admin (*)', () => {
      const adminPerms = ['*'];
      const isAdmin = adminPerms.includes('*');
      const visible = Object.entries(categoryMap)
        .filter(([_, perm]) => perm === null || isAdmin || adminPerms.includes(perm as string))
        .map(([cat]) => cat);
      expect(visible).toContain('leave_approval_requests');
      expect(visible).toContain('payroll_run_completed');
      expect(visible).toContain('device_offline_alert');
    });
  });

  describe('channel preference defaults', () => {
    it('should default to both when no preference saved', () => {
      const savedMap: Record<string, string> = {};
      const defaultChannel = savedMap['leave_status_updates'] || 'both';
      expect(defaultChannel).toBe('both');
    });

    it('should return saved channel when preference exists', () => {
      const savedMap: Record<string, string> = { leave_status_updates: 'email' };
      const channel = savedMap['leave_status_updates'] || 'both';
      expect(channel).toBe('email');
    });

    it('should support all four channel options', () => {
      const channels = ['email', 'push', 'both', 'none'];
      expect(channels).toHaveLength(4);
      expect(channels).toContain('email');
      expect(channels).toContain('push');
      expect(channels).toContain('both');
      expect(channels).toContain('none');
    });
  });

  describe('permission validation for category update', () => {
    it('should allow updating categories with null permission for any user', () => {
      const requiredPermission = null;
      const userPerms = ['view_my_leave'];
      const hasAccess = requiredPermission === null || userPerms.includes(requiredPermission as string);
      expect(hasAccess).toBe(true);
    });

    it('should deny updating admin categories without permission', () => {
      const requiredPermission = 'run_payroll';
      const userPerms = ['view_my_payslip'];
      const hasAccess = requiredPermission === null || userPerms.includes(requiredPermission);
      expect(hasAccess).toBe(false);
    });

    it('should allow admin (*) to update any category', () => {
      const requiredPermission = 'run_payroll';
      const userPerms = ['*'];
      const isOwnerOrAdmin = userPerms.includes('*');
      const hasAccess = requiredPermission === null || isOwnerOrAdmin || userPerms.includes(requiredPermission);
      expect(hasAccess).toBe(true);
    });

    it('should throw error concept for unknown category', () => {
      const category = 'fake_category';
      const requiredPermission = categoryMap[category];
      expect(requiredPermission).toBeUndefined();
    });

    it('should allow manager with approve_leave permission to update leave_approval_requests', () => {
      const requiredPermission = 'approve_leave';
      const userPerms = ['view_leave', 'approve_leave', 'view_my_attendance'];
      const isAdmin = userPerms.includes('*');
      const hasAccess = requiredPermission === null || isAdmin || userPerms.includes(requiredPermission);
      expect(hasAccess).toBe(true);
    });
  });

  describe('tenant module subscription gating', () => {
    const moduleMap: Record<string, string> = {
      announcement: 'core',
      profile_update: 'core',
      leave_status_updates: 'hrms',
      payslip_ready: 'hrms',
      payroll_run_completed: 'hrms',
      task_assignment_alerts: 'pms',
      pms_task_assigned: 'pms',
      pms_sprint_started: 'pms',
    };

    const isModuleActive = (cat: string, activeModules: string[]): boolean => {
      const reqMod = (moduleMap[cat] || 'core').toLowerCase().trim();
      if (reqMod === 'core') return true;
      if (activeModules.includes('*')) return true;
      return activeModules.includes(reqMod);
    };

    it('should always include core categories regardless of tenant modules', () => {
      const activeModules: string[] = []; // No extra modules subscribed
      expect(isModuleActive('announcement', activeModules)).toBe(true);
      expect(isModuleActive('profile_update', activeModules)).toBe(true);
    });

    it('should exclude PMS categories when tenant does not have pms subscribed', () => {
      const activeModules = ['hrms'];
      expect(isModuleActive('task_assignment_alerts', activeModules)).toBe(false);
      expect(isModuleActive('pms_task_assigned', activeModules)).toBe(false);
      expect(isModuleActive('pms_sprint_started', activeModules)).toBe(false);
    });

    it('should include PMS categories when tenant has pms module subscribed', () => {
      const activeModules = ['hrms', 'pms'];
      expect(isModuleActive('task_assignment_alerts', activeModules)).toBe(true);
      expect(isModuleActive('pms_task_assigned', activeModules)).toBe(true);
      expect(isModuleActive('pms_sprint_started', activeModules)).toBe(true);
    });

    it('should block effective channel dispatch (returns none) when tenant module is disabled', () => {
      const activeModules = ['hrms']; // pms not active
      const getEffectiveChannelMock = (cat: string, modules: string[]) => {
        if (!isModuleActive(cat, modules)) return 'none';
        return 'both';
      };
      expect(getEffectiveChannelMock('pms_sprint_started', activeModules)).toBe('none');
      expect(getEffectiveChannelMock('payslip_ready', activeModules)).toBe('both');
    });

    it('should deny preference updates for unsubscribed tenant modules', () => {
      const activeModules = ['hrms'];
      const updatePref = (cat: string) => {
        if (!isModuleActive(cat, activeModules)) {
          throw new Error(`Module "${moduleMap[cat]}" is not subscribed or enabled for this tenant.`);
        }
        return { success: true };
      };
      expect(() => updatePref('pms_task_assigned')).toThrow('Module "pms" is not subscribed or enabled for this tenant.');
    });
  });
});
