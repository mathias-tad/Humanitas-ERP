class BenefitPlanModel {
  final String id;
  final String name;
  final String type;
  final String? providerName;
  final String? policyNumber;
  final String? description;
  final double employerContribution;
  final double employeeContribution;
  final String frequency;
  final String? coverageDetails;
  final bool isActive;
  final DateTime? createdAt;

  const BenefitPlanModel({
    required this.id,
    required this.name,
    required this.type,
    this.providerName,
    this.policyNumber,
    this.description,
    this.employerContribution = 0.0,
    this.employeeContribution = 0.0,
    this.frequency = 'monthly',
    this.coverageDetails,
    this.isActive = true,
    this.createdAt,
  });

  factory BenefitPlanModel.fromJson(Map<String, dynamic> json) {
    return BenefitPlanModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      type: json['type'] as String? ?? 'custom',
      providerName: json['provider_name'] as String?,
      policyNumber: json['policy_number'] as String?,
      description: json['description'] as String?,
      employerContribution: (json['employer_contribution'] is num)
          ? (json['employer_contribution'] as num).toDouble()
          : double.tryParse(json['employer_contribution']?.toString() ?? '0') ?? 0.0,
      employeeContribution: (json['employee_contribution'] is num)
          ? (json['employee_contribution'] as num).toDouble()
          : double.tryParse(json['employee_contribution']?.toString() ?? '0') ?? 0.0,
      frequency: json['frequency'] as String? ?? 'monthly',
      coverageDetails: json['coverage_details'] as String?,
      isActive: json['is_active'] == true || json['is_active'] == 1,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type,
      'provider_name': providerName,
      'policy_number': policyNumber,
      'description': description,
      'employer_contribution': employerContribution,
      'employee_contribution': employeeContribution,
      'frequency': frequency,
      'coverage_details': coverageDetails,
      'is_active': isActive,
    };
  }
}

class BenefitDependentModel {
  final String id;
  final String enrollmentId;
  final String fullName;
  final String relationship;
  final String? dateOfBirth;
  final String? nationalId;
  final String coverageTier;

  const BenefitDependentModel({
    required this.id,
    required this.enrollmentId,
    required this.fullName,
    required this.relationship,
    this.dateOfBirth,
    this.nationalId,
    this.coverageTier = 'dependent',
  });

  factory BenefitDependentModel.fromJson(Map<String, dynamic> json) {
    return BenefitDependentModel(
      id: json['id'] as String? ?? '',
      enrollmentId: json['enrollment_id'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      relationship: json['relationship'] as String? ?? 'child',
      dateOfBirth: json['date_of_birth'] as String?,
      nationalId: json['national_id'] as String?,
      coverageTier: json['coverage_tier'] as String? ?? 'dependent',
    );
  }
}

class BenefitEnrollmentModel {
  final String id;
  final String userId;
  final String? userName;
  final String planId;
  final String? planName;
  final String? planType;
  final String coverageTier;
  final double employerCost;
  final double employeeCost;
  final String status;
  final String? effectiveDate;
  final String? endDate;
  final List<BenefitDependentModel> dependents;

  const BenefitEnrollmentModel({
    required this.id,
    required this.userId,
    this.userName,
    required this.planId,
    this.planName,
    this.planType,
    this.coverageTier = 'employee_only',
    this.employerCost = 0.0,
    this.employeeCost = 0.0,
    this.status = 'active',
    this.effectiveDate,
    this.endDate,
    this.dependents = const [],
  });

  factory BenefitEnrollmentModel.fromJson(Map<String, dynamic> json) {
    return BenefitEnrollmentModel(
      id: json['id'] as String? ?? '',
      userId: json['user_id'] as String? ?? '',
      userName: json['user_name'] as String?,
      planId: json['plan_id'] as String? ?? '',
      planName: json['plan_name'] as String?,
      planType: json['plan_type'] as String?,
      coverageTier: json['coverage_tier'] as String? ?? 'employee_only',
      employerCost: (json['employer_cost'] is num)
          ? (json['employer_cost'] as num).toDouble()
          : double.tryParse(json['employer_cost']?.toString() ?? '0') ?? 0.0,
      employeeCost: (json['employee_cost'] is num)
          ? (json['employee_cost'] as num).toDouble()
          : double.tryParse(json['employee_cost']?.toString() ?? '0') ?? 0.0,
      status: json['status'] as String? ?? 'active',
      effectiveDate: json['effective_date'] as String?,
      endDate: json['end_date'] as String?,
      dependents: (json['dependents'] as List<dynamic>?)
              ?.map((d) => BenefitDependentModel.fromJson(d as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }
}

class BenefitStatsModel {
  final int totalPlans;
  final int activeEnrollments;
  final double totalMonthlyEmployerCost;
  final double totalMonthlyEmployeeCost;
  final int enrolledEmployeesCount;

  const BenefitStatsModel({
    this.totalPlans = 0,
    this.activeEnrollments = 0,
    this.totalMonthlyEmployerCost = 0.0,
    this.totalMonthlyEmployeeCost = 0.0,
    this.enrolledEmployeesCount = 0,
  });

  factory BenefitStatsModel.fromJson(Map<String, dynamic> json) {
    return BenefitStatsModel(
      totalPlans: (json['total_plans'] as num?)?.toInt() ?? 0,
      activeEnrollments: (json['active_enrollments'] as num?)?.toInt() ?? 0,
      totalMonthlyEmployerCost: (json['total_monthly_employer_cost'] is num)
          ? (json['total_monthly_employer_cost'] as num).toDouble()
          : double.tryParse(json['total_monthly_employer_cost']?.toString() ?? '0') ?? 0.0,
      totalMonthlyEmployeeCost: (json['total_monthly_employee_cost'] is num)
          ? (json['total_monthly_employee_cost'] as num).toDouble()
          : double.tryParse(json['total_monthly_employee_cost']?.toString() ?? '0') ?? 0.0,
      enrolledEmployeesCount: (json['enrolled_employees_count'] as num?)?.toInt() ?? 0,
    );
  }
}
