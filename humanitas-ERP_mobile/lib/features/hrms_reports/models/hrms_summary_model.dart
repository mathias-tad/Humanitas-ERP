class HrmsSummaryModel {
  final int totalHeadcount;
  final int activeEmployees;
  final int newHiresThisMonth;
  final double turnoverRatePercentage;
  final double averageTenureYears;
  final double absenteeismRatePercentage;
  final double monthlyWorkforceSpend;

  const HrmsSummaryModel({
    required this.totalHeadcount,
    required this.activeEmployees,
    required this.newHiresThisMonth,
    required this.turnoverRatePercentage,
    required this.averageTenureYears,
    required this.absenteeismRatePercentage,
    required this.monthlyWorkforceSpend,
  });

  factory HrmsSummaryModel.fromJson(Map<String, dynamic> json) {
    return HrmsSummaryModel(
      totalHeadcount: json['totalHeadcount'] as int? ?? 0,
      activeEmployees: json['activeEmployees'] as int? ?? 0,
      newHiresThisMonth: json['newHiresThisMonth'] as int? ?? 0,
      turnoverRatePercentage: (json['turnoverRatePercentage'] as num?)?.toDouble() ?? 0.0,
      averageTenureYears: (json['averageTenureYears'] as num?)?.toDouble() ?? 0.0,
      absenteeismRatePercentage: (json['absenteeismRatePercentage'] as num?)?.toDouble() ?? 0.0,
      monthlyWorkforceSpend: (json['monthlyWorkforceSpend'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class DepartmentHeadcountItem {
  final String name;
  final int count;

  const DepartmentHeadcountItem({required this.name, required this.count});

  factory DepartmentHeadcountItem.fromJson(Map<String, dynamic> json) {
    return DepartmentHeadcountItem(
      name: json['name'] as String? ?? 'General',
      count: json['count'] as int? ?? 0,
    );
  }
}

class HeadcountDemographicsModel {
  final List<DepartmentHeadcountItem> byDepartment;
  final List<DepartmentHeadcountItem> byGender;
  final List<DepartmentHeadcountItem> byTenure;
  final List<DepartmentHeadcountItem> byEmploymentType;

  const HeadcountDemographicsModel({
    required this.byDepartment,
    required this.byGender,
    required this.byTenure,
    required this.byEmploymentType,
  });

  factory HeadcountDemographicsModel.fromJson(Map<String, dynamic> json) {
    return HeadcountDemographicsModel(
      byDepartment: (json['byDepartment'] as List<dynamic>?)
              ?.map((e) => DepartmentHeadcountItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      byGender: (json['byGender'] as List<dynamic>?)
              ?.map((e) => DepartmentHeadcountItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      byTenure: (json['byTenure'] as List<dynamic>?)
              ?.map((e) => DepartmentHeadcountItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      byEmploymentType: (json['byEmploymentType'] as List<dynamic>?)
              ?.map((e) => DepartmentHeadcountItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
