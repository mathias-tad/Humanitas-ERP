class SurveyQuestionModel {
  final String id;
  final String surveyId;
  final String questionText;
  final String questionType; // rating, enps, choice, text
  final List<String> options;
  final bool isRequired;
  final int sortOrder;

  const SurveyQuestionModel({
    required this.id,
    required this.surveyId,
    required this.questionText,
    required this.questionType,
    this.options = const [],
    this.isRequired = true,
    this.sortOrder = 0,
  });

  factory SurveyQuestionModel.fromJson(Map<String, dynamic> json) {
    List<String> parsedOptions = [];
    if (json['options'] != null) {
      if (json['options'] is List) {
        parsedOptions = (json['options'] as List).map((e) => e.toString()).toList();
      } else if (json['options'] is String) {
        try {
          final decoded = json['options'].toString();
          parsedOptions = decoded.split(',').map((e) => e.trim()).toList();
        } catch (_) {}
      }
    }

    return SurveyQuestionModel(
      id: json['id']?.toString() ?? '',
      surveyId: json['survey_id']?.toString() ?? '',
      questionText: json['question_text']?.toString() ?? '',
      questionType: json['question_type']?.toString() ?? 'rating',
      options: parsedOptions,
      isRequired: json['is_required'] == true || json['is_required'] == 1,
      sortOrder: int.tryParse(json['sort_order']?.toString() ?? '0') ?? 0,
    );
  }
}

class SurveyModel {
  final String id;
  final String title;
  final String? description;
  final bool isAnonymous;
  final String category;
  final String status;
  final String? startDate;
  final String? endDate;
  final String? targetDepartment;
  final int minResponsesForResults;
  final int responseCount;
  final bool hasResponded;
  final List<SurveyQuestionModel> questions;

  const SurveyModel({
    required this.id,
    required this.title,
    this.description,
    this.isAnonymous = true,
    this.category = 'engagement',
    this.status = 'active',
    this.startDate,
    this.endDate,
    this.targetDepartment,
    this.minResponsesForResults = 3,
    this.responseCount = 0,
    this.hasResponded = false,
    this.questions = const [],
  });

  factory SurveyModel.fromJson(Map<String, dynamic> json) {
    final questionsList = json['questions'] as List<dynamic>? ?? [];
    return SurveyModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Pulse Survey',
      description: json['description']?.toString(),
      isAnonymous: json['is_anonymous'] == true || json['is_anonymous'] == 1,
      category: json['category']?.toString() ?? 'engagement',
      status: json['status']?.toString() ?? 'active',
      startDate: json['start_date']?.toString(),
      endDate: json['end_date']?.toString(),
      targetDepartment: json['target_department']?.toString(),
      minResponsesForResults: int.tryParse(json['min_responses_for_results']?.toString() ?? '3') ?? 3,
      responseCount: int.tryParse(json['response_count']?.toString() ?? '0') ?? 0,
      hasResponded: json['has_responded'] == true || json['has_responded'] == 1,
      questions: questionsList.map((e) => SurveyQuestionModel.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

class SurveyAnalyticsModel {
  final int activeSurveys;
  final int totalResponses;
  final double averageEnps;
  final int actionItemsCount;

  const SurveyAnalyticsModel({
    required this.activeSurveys,
    required this.totalResponses,
    required this.averageEnps,
    required this.actionItemsCount,
  });

  factory SurveyAnalyticsModel.fromJson(Map<String, dynamic> json) {
    return SurveyAnalyticsModel(
      activeSurveys: int.tryParse(json['active_surveys']?.toString() ?? '0') ?? 0,
      totalResponses: int.tryParse(json['total_responses']?.toString() ?? '0') ?? 0,
      averageEnps: double.tryParse(json['average_enps']?.toString() ?? '0') ?? 0.0,
      actionItemsCount: int.tryParse(json['action_items_count']?.toString() ?? '0') ?? 0,
    );
  }
}

class SurveyActionItemModel {
  final String id;
  final String surveyId;
  final String title;
  final String? description;
  final String? assigneeName;
  final String status;
  final String priority;
  final String? dueDate;

  const SurveyActionItemModel({
    required this.id,
    required this.surveyId,
    required this.title,
    this.description,
    this.assigneeName,
    required this.status,
    required this.priority,
    this.dueDate,
  });

  factory SurveyActionItemModel.fromJson(Map<String, dynamic> json) {
    return SurveyActionItemModel(
      id: json['id']?.toString() ?? '',
      surveyId: json['survey_id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString(),
      assigneeName: json['assignee_name']?.toString(),
      status: json['status']?.toString() ?? 'pending',
      priority: json['priority']?.toString() ?? 'medium',
      dueDate: json['due_date']?.toString(),
    );
  }
}
