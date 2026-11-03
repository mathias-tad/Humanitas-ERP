import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class CalendarEventModel {
  final String id;
  final String title;
  final String? description;
  final DateTime start;
  final DateTime? end;
  final bool allDay;
  final String source;
  final String moduleKey;
  final String category; // 'common' | 'workforce' | 'projects' | 'commercial' | 'financial'
  final String eventType;
  final String colorHex;
  final String? location;
  final String? sourceId;
  final String? routeUrl;
  final String? status;
  final String? priority;
  final bool isPublic;
  final String? createdBy;
  final String? createdByName;

  CalendarEventModel({
    required this.id,
    required this.title,
    this.description,
    required this.start,
    this.end,
    this.allDay = false,
    required this.source,
    this.moduleKey = 'calendar',
    this.category = 'common',
    this.eventType = 'custom',
    this.colorHex = '#D4A017',
    this.location,
    this.sourceId,
    this.routeUrl,
    this.status,
    this.priority,
    this.isPublic = true,
    this.createdBy,
    this.createdByName,
  });

  Color get color {
    try {
      final hex = colorHex.replaceAll('#', '');
      if (hex.length == 6) {
        return Color(int.parse('FF$hex', radix: 16));
      }
    } catch (_) {}
    return const Color(0xFFD4A017);
  }

  String get formattedTime {
    if (allDay) return 'All Day';
    final timeFormat = DateFormat('h:mm a');
    final startTime = timeFormat.format(start);
    if (end != null) {
      return '$startTime - ${timeFormat.format(end!)}';
    }
    return startTime;
  }

  factory CalendarEventModel.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic val) {
      if (val is DateTime) return val;
      if (val is String) {
        return DateTime.tryParse(val) ?? DateTime.now();
      }
      return DateTime.now();
    }

    return CalendarEventModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString(),
      start: parseDate(json['start'] ?? json['start_date']),
      end: json['end'] != null || json['end_date'] != null
          ? parseDate(json['end'] ?? json['end_date'])
          : null,
      allDay: json['allDay'] == true || json['all_day'] == true,
      source: json['source']?.toString() ?? 'custom',
      moduleKey: json['moduleKey']?.toString() ?? 'calendar',
      category: json['category']?.toString() ?? 'common',
      eventType: json['eventType']?.toString() ?? json['event_type']?.toString() ?? 'custom',
      colorHex: json['color']?.toString() ?? '#D4A017',
      location: json['location']?.toString(),
      sourceId: json['sourceId']?.toString() ?? json['source_id']?.toString(),
      routeUrl: json['routeUrl']?.toString(),
      status: json['status']?.toString(),
      priority: json['priority']?.toString(),
      isPublic: json['isPublic'] ?? json['is_public'] ?? true,
      createdBy: json['createdBy']?.toString() ?? json['created_by']?.toString(),
      createdByName: json['createdByName']?.toString() ?? json['created_by_name']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'start_date': start.toIso8601String(),
      'end_date': end?.toIso8601String(),
      'all_day': allDay,
      'source': source,
      'module_key': moduleKey,
      'category': category,
      'event_type': eventType,
      'color': colorHex,
      'location': location,
      'source_id': sourceId,
      'is_public': isPublic,
    };
  }
}
