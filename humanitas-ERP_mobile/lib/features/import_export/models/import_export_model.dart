class ImportExportStatsModel {
  final int totalImports;
  final int totalExports;
  final int totalRowsProcessed;
  final int successRatePct;
  final int activeSchedules;

  const ImportExportStatsModel({
    required this.totalImports,
    required this.totalExports,
    required this.totalRowsProcessed,
    required this.successRatePct,
    required this.activeSchedules,
  });

  factory ImportExportStatsModel.fromJson(Map<String, dynamic> json) {
    return ImportExportStatsModel(
      totalImports: int.tryParse(json['total_imports']?.toString() ?? '0') ?? 0,
      totalExports: int.tryParse(json['total_exports']?.toString() ?? '0') ?? 0,
      totalRowsProcessed: int.tryParse(json['total_rows_processed']?.toString() ?? '0') ?? 0,
      successRatePct: int.tryParse(json['success_rate_pct']?.toString() ?? '100') ?? 100,
      activeSchedules: int.tryParse(json['active_schedules']?.toString() ?? '0') ?? 0,
    );
  }
}

class ImportExportJobModel {
  final String id;
  final String jobType; // import, export
  final String entityType;
  final String format; // csv, xlsx, pdf
  final String status; // pending, validating, validated, completed, failed, rolled_back
  final String? fileName;
  final int totalRows;
  final int processedRows;
  final int errorRows;
  final bool canRollback;
  final bool isRollbackActive;
  final String? createdAt;

  const ImportExportJobModel({
    required this.id,
    required this.jobType,
    required this.entityType,
    required this.format,
    required this.status,
    this.fileName,
    required this.totalRows,
    required this.processedRows,
    required this.errorRows,
    this.canRollback = false,
    this.isRollbackActive = false,
    this.createdAt,
  });

  factory ImportExportJobModel.fromJson(Map<String, dynamic> json) {
    return ImportExportJobModel(
      id: json['id']?.toString() ?? '',
      jobType: json['job_type']?.toString() ?? 'export',
      entityType: json['entity_type']?.toString() ?? 'employees',
      format: json['format']?.toString() ?? 'csv',
      status: json['status']?.toString() ?? 'completed',
      fileName: json['file_name']?.toString(),
      totalRows: int.tryParse(json['total_rows']?.toString() ?? '0') ?? 0,
      processedRows: int.tryParse(json['processed_rows']?.toString() ?? '0') ?? 0,
      errorRows: int.tryParse(json['error_rows']?.toString() ?? '0') ?? 0,
      canRollback: json['can_rollback'] == true || json['can_rollback'] == 1,
      isRollbackActive: json['is_rollback_active'] == true || json['is_rollback_active'] == 1,
      createdAt: json['created_at']?.toString(),
    );
  }
}

class ExportTemplateModel {
  final String id;
  final String name;
  final String entityType;
  final String? scheduleCron;
  final String? deliveryEmail;
  final bool isActive;

  const ExportTemplateModel({
    required this.id,
    required this.name,
    required this.entityType,
    this.scheduleCron,
    this.deliveryEmail,
    this.isActive = true,
  });

  factory ExportTemplateModel.fromJson(Map<String, dynamic> json) {
    return ExportTemplateModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      entityType: json['entity_type']?.toString() ?? 'employees',
      scheduleCron: json['schedule_cron']?.toString(),
      deliveryEmail: json['delivery_email']?.toString(),
      isActive: json['is_active'] == true || json['is_active'] == 1,
    );
  }
}
