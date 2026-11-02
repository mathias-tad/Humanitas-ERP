class WfmOpportunityModel {
  final String id;
  final String? companyId;
  final String? branchId;
  final String? departmentId;
  final String type; // 'VET' or 'VTO'
  final String title;
  final String date;
  final String? shiftId;
  final String? shiftName;
  final String? startTime;
  final String? endTime;
  final double hours;
  final int slotsAvailable;
  final int slotsClaimed;
  final int slotsRemaining;
  final double otRateMultiplier;
  final String otCategory;
  final String vtoCompensationType;
  final String urgency;
  final String status;
  final String? reason;
  final bool hasClaimed;
  final String? myClaimId;
  final String? myClaimStatus;

  const WfmOpportunityModel({
    required this.id,
    this.companyId,
    this.branchId,
    this.departmentId,
    required this.type,
    required this.title,
    required this.date,
    this.shiftId,
    this.shiftName,
    this.startTime,
    this.endTime,
    required this.hours,
    required this.slotsAvailable,
    required this.slotsClaimed,
    required this.slotsRemaining,
    required this.otRateMultiplier,
    required this.otCategory,
    this.vtoCompensationType = 'unpaid',
    required this.urgency,
    required this.status,
    this.reason,
    this.hasClaimed = false,
    this.myClaimId,
    this.myClaimStatus,
  });

  factory WfmOpportunityModel.fromJson(Map<String, dynamic> json) {
    return WfmOpportunityModel(
      id: json['id']?.toString() ?? '',
      companyId: json['company_id']?.toString(),
      branchId: json['branch_id']?.toString(),
      departmentId: json['department_id']?.toString(),
      type: json['type']?.toString() ?? 'VET',
      title: json['title']?.toString() ?? '',
      date: json['date']?.toString() ?? '',
      shiftId: json['shift_id']?.toString(),
      shiftName: json['shift_name']?.toString(),
      startTime: json['start_time']?.toString(),
      endTime: json['end_time']?.toString(),
      hours: double.tryParse(json['hours']?.toString() ?? '0') ?? 0.0,
      slotsAvailable: int.tryParse(json['slots_available']?.toString() ?? '1') ?? 1,
      slotsClaimed: int.tryParse(json['slots_claimed']?.toString() ?? '0') ?? 0,
      slotsRemaining: int.tryParse(json['slots_remaining']?.toString() ?? '1') ?? 1,
      otRateMultiplier: double.tryParse(json['ot_rate_multiplier']?.toString() ?? '1.5') ?? 1.5,
      otCategory: json['ot_category']?.toString() ?? 'normal',
      vtoCompensationType: json['vto_compensation_type']?.toString() ?? 'unpaid',
      urgency: json['urgency']?.toString() ?? 'normal',
      status: json['status']?.toString() ?? 'open',
      reason: json['reason']?.toString(),
      hasClaimed: json['has_claimed'] == true,
      myClaimId: json['my_claim_id']?.toString(),
      myClaimStatus: json['my_claim_status']?.toString(),
    );
  }
}

class WfmClaimModel {
  final String id;
  final String opportunityId;
  final String userId;
  final String claimType;
  final String status;
  final String claimedAt;
  final bool usePtoBalance;
  final bool isPaid;
  final String vtoCompensationType;
  final String? reviewNotes;
  final String? opportunityTitle;
  final String? opportunityDate;
  final double? hours;
  final double? otRateMultiplier;

  const WfmClaimModel({
    required this.id,
    required this.opportunityId,
    required this.userId,
    required this.claimType,
    required this.status,
    required this.claimedAt,
    this.usePtoBalance = false,
    this.isPaid = false,
    this.vtoCompensationType = 'unpaid',
    this.reviewNotes,
    this.opportunityTitle,
    this.opportunityDate,
    this.hours,
    this.otRateMultiplier,
  });

  factory WfmClaimModel.fromJson(Map<String, dynamic> json) {
    return WfmClaimModel(
      id: json['id']?.toString() ?? '',
      opportunityId: json['opportunity_id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      claimType: json['claim_type']?.toString() ?? 'VET',
      status: json['status']?.toString() ?? 'pending',
      claimedAt: json['claimed_at']?.toString() ?? '',
      usePtoBalance: json['use_pto_balance'] == true,
      isPaid: json['is_paid'] == true,
      vtoCompensationType: json['vto_compensation_type']?.toString() ?? 'unpaid',
      reviewNotes: json['review_notes']?.toString(),
      opportunityTitle: json['opportunity_title']?.toString(),
      opportunityDate: json['opportunity_date']?.toString(),
      hours: double.tryParse(json['hours']?.toString() ?? '0'),
      otRateMultiplier: double.tryParse(json['ot_rate_multiplier']?.toString() ?? '1.5'),
    );
  }
}

class PayrollOtRatesModel {
  final double? normal;
  final double? night;
  final double? dayoff;
  final double? holiday;

  const PayrollOtRatesModel({
    this.normal,
    this.night,
    this.dayoff,
    this.holiday,
  });

  factory PayrollOtRatesModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const PayrollOtRatesModel();
    return PayrollOtRatesModel(
      normal: json['normal'] != null ? double.tryParse(json['normal'].toString()) : null,
      night: json['night'] != null ? double.tryParse(json['night'].toString()) : null,
      dayoff: json['dayoff'] != null ? double.tryParse(json['dayoff'].toString()) : null,
      holiday: json['holiday'] != null ? double.tryParse(json['holiday'].toString()) : null,
    );
  }

  double? getRate(String category) {
    switch (category) {
      case 'night':
        return night;
      case 'dayoff':
        return dayoff;
      case 'holiday':
        return holiday;
      case 'normal':
      default:
        return normal;
    }
  }
}

class WfmSettingsModel {
  final String? id;
  final bool vetEnabled;
  final bool vtoEnabled;
  final String defaultVtoCompensation;
  final PayrollOtRatesModel payrollOtRates;

  const WfmSettingsModel({
    this.id,
    this.vetEnabled = true,
    this.vtoEnabled = true,
    this.defaultVtoCompensation = 'unpaid',
    this.payrollOtRates = const PayrollOtRatesModel(),
  });

  factory WfmSettingsModel.fromJson(Map<String, dynamic> json) {
    return WfmSettingsModel(
      id: json['id']?.toString(),
      vetEnabled: json['vet_enabled'] != false,
      vtoEnabled: json['vto_enabled'] != false,
      defaultVtoCompensation: json['default_vto_compensation']?.toString() ?? 'unpaid',
      payrollOtRates: PayrollOtRatesModel.fromJson(
        json['payroll_ot_rates'] is Map<String, dynamic>
            ? json['payroll_ot_rates'] as Map<String, dynamic>
            : null,
      ),
    );
  }
}
