/// CRM on mobile: leads, deals (opportunities), activities and follow-ups (featureslist §4.1);
/// mirrors the tenant API under /crm.
String? _str(dynamic v) {
  if (v == null) return null;
  final s = v.toString();
  return s.isEmpty ? null : s;
}

double? _numOrNull(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse(v.toString()));

double _num(dynamic v) => _numOrNull(v) ?? 0;

DateTime? _date(dynamic v) => v == null ? null : DateTime.tryParse(v.toString())?.toLocal();

/// "2026-12-31" from a date or a timestamp.
String? _day(dynamic v) {
  final s = _str(v);
  if (s == null) return null;
  return s.length >= 10 ? s.substring(0, 10) : s;
}

List<String> _strings(dynamic v) => v is List ? v.map((e) => e.toString()).toList() : const [];

// ── Leads ───────────────────────────────────────────────────────────────────

const leadStatusLabel = <String, String>{
  'new': 'New',
  'contacted': 'Contacted',
  'qualified': 'Qualified',
  'converted': 'Converted',
  'lost': 'Lost',
};

/// Status moves a person can make by hand (the server's crm.rules.ts); converting and losing have their own actions.
const _manualMoves = <String, List<String>>{
  'new': ['contacted', 'qualified'],
  'contacted': ['new', 'qualified'],
  'qualified': ['new', 'contacted'],
  'converted': [],
  'lost': ['new', 'contacted', 'qualified'],
};

/// The statuses a lead in [from] can be moved to by hand.
List<String> leadStatusMoves(String from) => _manualMoves[from] ?? const [];

class Lead {
  final String id;
  final String code;
  final String title;
  final String? personName;
  final String? companyName;
  final String? jobTitle;
  final String? email;
  final String? phone;
  final String? mobile;
  final String? city;
  final String? sourceId;
  final String? sourceName;
  final String? ownerId;
  final String? ownerName;
  final String status;
  final String? need;
  final double? budget;
  final String? timeline;
  final String? decisionMaker;
  final double? expectedRevenue;
  final String? lostReasonName;
  final String? lostNote;
  final String? convertedContactId;
  final String? convertedContactName;
  final String? convertedOpportunityId;
  final String? convertedOpportunityName;
  final List<String> tags;
  final String? notes;
  final bool isActive;
  final DateTime? nextActivityAt;
  final DateTime? lastContactAt;
  final String? lastContactChannel;
  final int contactCount;

  const Lead({
    required this.id,
    required this.code,
    required this.title,
    this.personName,
    this.companyName,
    this.jobTitle,
    this.email,
    this.phone,
    this.mobile,
    this.city,
    this.sourceId,
    this.sourceName,
    this.ownerId,
    this.ownerName,
    this.status = 'new',
    this.need,
    this.budget,
    this.timeline,
    this.decisionMaker,
    this.expectedRevenue,
    this.lostReasonName,
    this.lostNote,
    this.convertedContactId,
    this.convertedContactName,
    this.convertedOpportunityId,
    this.convertedOpportunityName,
    this.tags = const [],
    this.notes,
    this.isActive = true,
    this.nextActivityAt,
    this.lastContactAt,
    this.lastContactChannel,
    this.contactCount = 0,
  });

  /// "Sara · Abebe Trading", or "—" when nobody is named.
  String get who {
    final parts = [personName, companyName].whereType<String>().where((s) => s.isNotEmpty).toList();
    return parts.isEmpty ? '—' : parts.join(' · ');
  }

  bool get isOpen => status == 'new' || status == 'contacted' || status == 'qualified';

  String get statusLabel => leadStatusLabel[status] ?? status;

  factory Lead.fromJson(Map<String, dynamic> j) => Lead(
        id: j['id']?.toString() ?? '',
        code: j['code']?.toString() ?? '',
        title: j['title']?.toString() ?? '',
        personName: _str(j['person_name']),
        companyName: _str(j['company_name']),
        jobTitle: _str(j['job_title']),
        email: _str(j['email']),
        phone: _str(j['phone']),
        mobile: _str(j['mobile']),
        city: _str(j['city']),
        sourceId: _str(j['source_id']),
        sourceName: _str(j['source_name']),
        ownerId: _str(j['owner_id']),
        ownerName: _str(j['owner_name']),
        status: j['status']?.toString() ?? 'new',
        need: _str(j['need']),
        budget: _numOrNull(j['budget']),
        timeline: _str(j['timeline']),
        decisionMaker: _str(j['decision_maker']),
        expectedRevenue: _numOrNull(j['expected_revenue']),
        lostReasonName: _str(j['lost_reason_name']),
        lostNote: _str(j['lost_note']),
        convertedContactId: _str(j['converted_contact_id']),
        convertedContactName: _str(j['converted_contact_name']),
        convertedOpportunityId: _str(j['converted_opportunity_id']),
        convertedOpportunityName: _str(j['converted_opportunity_name']),
        tags: _strings(j['tags']),
        notes: _str(j['notes']),
        isActive: j['is_active'] != false,
        nextActivityAt: _date(j['next_activity_at']),
        lastContactAt: _date(j['last_contact_at']),
        lastContactChannel: _str(j['last_contact_channel']),
        contactCount: _num(j['contact_count']).toInt(),
      );
}

/// What the lead form sends: only the fields the server accepts (CreateLeadDto / UpdateLeadDto).
/// Blank text is sent as null so a cleared field is cleared on the server.
Map<String, dynamic> leadBody({
  required String title,
  String personName = '',
  String companyName = '',
  String jobTitle = '',
  String phone = '',
  String mobile = '',
  String email = '',
  String city = '',
  String? sourceId,
  String need = '',
  String budget = '',
  String timeline = '',
  String decisionMaker = '',
  String expectedRevenue = '',
  String notes = '',
}) {
  String? t(String v) => v.trim().isEmpty ? null : v.trim();
  double? n(String v) => v.trim().isEmpty ? null : double.tryParse(v.trim().replaceAll(',', ''));
  return {
    'title': title.trim(),
    'person_name': t(personName),
    'company_name': t(companyName),
    'job_title': t(jobTitle),
    'phone': t(phone),
    'mobile': t(mobile),
    'email': t(email),
    'city': t(city),
    'source_id': sourceId,
    'need': t(need),
    'budget': n(budget),
    'timeline': t(timeline),
    'decision_maker': t(decisionMaker),
    'expected_revenue': n(expectedRevenue),
    'notes': t(notes),
  };
}

/// What is wrong with the lead form, or null.
String? leadFormProblem({required String title, String email = '', String budget = '', String expectedRevenue = ''}) {
  if (title.trim().isEmpty) return 'Say what they want (the lead title)';
  if (email.trim().isNotEmpty && !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email.trim())) return 'That email does not look right';
  for (final v in [budget, expectedRevenue]) {
    if (v.trim().isEmpty) continue;
    final n = double.tryParse(v.trim().replaceAll(',', ''));
    if (n == null || n < 0) return 'Amounts are numbers of 0 or more';
  }
  return null;
}

// ── Deals ───────────────────────────────────────────────────────────────────

class Deal {
  final String id;
  final String code;
  final String name;
  final String? contactId;
  final String? contactName;
  final String? personId;
  final String? personName;
  final String pipelineId;
  final String? pipelineName;
  final String stageId;
  final String? stageName;
  final double stageProbability;
  final String? ownerId;
  final String? ownerName;
  final double expectedRevenue;
  final String currency;
  final double? probability;
  final double effectiveProbability;
  final double weightedRevenue;
  final String? expectedCloseDate;
  final String status;
  final String? lostReasonName;
  final String? lostNote;
  final String? leadId;
  final String? leadCode;
  final String? sourceName;
  final String? notes;
  final bool isActive;
  final int daysInStage;
  final bool isStuck;
  final DateTime? nextActivityAt;
  final DateTime? lastContactAt;
  final String? lastContactChannel;
  final int contactCount;

  const Deal({
    required this.id,
    required this.code,
    required this.name,
    this.contactId,
    this.contactName,
    this.personId,
    this.personName,
    required this.pipelineId,
    this.pipelineName,
    required this.stageId,
    this.stageName,
    this.stageProbability = 0,
    this.ownerId,
    this.ownerName,
    this.expectedRevenue = 0,
    this.currency = 'ETB',
    this.probability,
    this.effectiveProbability = 0,
    this.weightedRevenue = 0,
    this.expectedCloseDate,
    this.status = 'open',
    this.lostReasonName,
    this.lostNote,
    this.leadId,
    this.leadCode,
    this.sourceName,
    this.notes,
    this.isActive = true,
    this.daysInStage = 0,
    this.isStuck = false,
    this.nextActivityAt,
    this.lastContactAt,
    this.lastContactChannel,
    this.contactCount = 0,
  });

  bool get isOpen => status == 'open';

  /// "Abebe Trading · Sara", or the person alone.
  String get customer => [contactName, personName].whereType<String>().where((s) => s.isNotEmpty).join(' · ');

  factory Deal.fromJson(Map<String, dynamic> j) => Deal(
        id: j['id']?.toString() ?? '',
        code: j['code']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        contactId: _str(j['contact_id']),
        contactName: _str(j['contact_name']),
        personId: _str(j['person_id']),
        personName: _str(j['person_name']),
        pipelineId: j['pipeline_id']?.toString() ?? '',
        pipelineName: _str(j['pipeline_name']),
        stageId: j['stage_id']?.toString() ?? '',
        stageName: _str(j['stage_name']),
        stageProbability: _num(j['stage_probability']),
        ownerId: _str(j['owner_id']),
        ownerName: _str(j['owner_name']),
        expectedRevenue: _num(j['expected_revenue']),
        currency: _str(j['currency']) ?? 'ETB',
        probability: _numOrNull(j['probability']),
        effectiveProbability: _num(j['effective_probability']),
        weightedRevenue: _num(j['weighted_revenue']),
        expectedCloseDate: _day(j['expected_close_date']),
        status: j['status']?.toString() ?? 'open',
        lostReasonName: _str(j['lost_reason_name']),
        lostNote: _str(j['lost_note']),
        leadId: _str(j['lead_id']),
        leadCode: _str(j['lead_code']),
        sourceName: _str(j['source_name']),
        notes: _str(j['notes']),
        isActive: j['is_active'] != false,
        daysInStage: _num(j['days_in_stage']).toInt(),
        isStuck: j['is_stuck'] == true,
        nextActivityAt: _date(j['next_activity_at']),
        lastContactAt: _date(j['last_contact_at']),
        lastContactChannel: _str(j['last_contact_channel']),
        contactCount: _num(j['contact_count']).toInt(),
      );
}

/// A deal's health, as on the web board: won, lost, late (a step past due or past the close date),
/// needs a next step (nothing planned, or stuck in its stage) or on track.
enum DealHealth { onTrack, attention, late, won, lost }

const dealHealthLabel = <DealHealth, String>{
  DealHealth.onTrack: 'On track',
  DealHealth.attention: 'Needs a next step',
  DealHealth.late: 'Late',
  DealHealth.won: 'Won',
  DealHealth.lost: 'Lost',
};

DealHealth dealHealth(Deal d, {DateTime? now}) {
  final at = now ?? DateTime.now();
  if (d.status == 'won') return DealHealth.won;
  if (d.status == 'lost') return DealHealth.lost;
  final today = _ymd(at);
  final pastClose = d.expectedCloseDate != null && d.expectedCloseDate!.compareTo(today) < 0;
  if ((d.nextActivityAt != null && d.nextActivityAt!.isBefore(at)) || pastClose) return DealHealth.late;
  if (d.nextActivityAt == null || d.isStuck) return DealHealth.attention;
  return DealHealth.onTrack;
}

String _ymd(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// The date part (YYYY-MM-DD) the server expects for a close date.
String ymd(DateTime d) => _ymd(d);

/// What the deal form sends (CreateOpportunityDto / UpdateOpportunityDto).
Map<String, dynamic> dealBody({
  required String name,
  String? contactId,
  String? personId,
  String expectedRevenue = '',
  String probability = '',
  String? expectedCloseDate,
  String notes = '',
  String? pipelineId,
  String? stageId,
}) {
  double? n(String v) => v.trim().isEmpty ? null : double.tryParse(v.trim().replaceAll(',', ''));
  return {
    'name': name.trim(),
    'contact_id': contactId,
    'person_id': personId,
    'expected_revenue': n(expectedRevenue) ?? 0,
    'probability': n(probability),
    'expected_close_date': expectedCloseDate,
    'notes': notes.trim().isEmpty ? null : notes.trim(),
    'pipeline_id': ?pipelineId,
    'stage_id': ?stageId,
  };
}

String? dealFormProblem({required String name, String expectedRevenue = '', String probability = ''}) {
  if (name.trim().isEmpty) return 'Name the deal';
  if (expectedRevenue.trim().isNotEmpty) {
    final n = double.tryParse(expectedRevenue.trim().replaceAll(',', ''));
    if (n == null || n < 0) return 'Expected revenue is a number of 0 or more';
  }
  if (probability.trim().isNotEmpty) {
    final p = double.tryParse(probability.trim());
    if (p == null || p < 0 || p > 100) return 'Probability is between 0 and 100';
  }
  return null;
}

class Stage {
  final String id;
  final String pipelineId;
  final String name;
  final double probability;
  final bool isWon;
  final bool isLost;
  final int sortOrder;
  final bool isActive;

  const Stage({
    required this.id,
    required this.pipelineId,
    required this.name,
    this.probability = 0,
    this.isWon = false,
    this.isLost = false,
    this.sortOrder = 0,
    this.isActive = true,
  });

  factory Stage.fromJson(Map<String, dynamic> j) => Stage(
        id: j['id']?.toString() ?? '',
        pipelineId: j['pipeline_id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        probability: _num(j['probability']),
        isWon: j['is_won'] == true,
        isLost: j['is_lost'] == true,
        sortOrder: _num(j['sort_order']).toInt(),
        isActive: j['is_active'] != false,
      );
}

class Pipeline {
  final String id;
  final String name;
  final bool isDefault;
  final List<Stage> stages;

  const Pipeline({required this.id, required this.name, this.isDefault = false, this.stages = const []});

  /// The stages a deal can be moved to by hand: active, in order, without the lost stage (losing needs a reason).
  List<Stage> get movableStages => (stages.where((s) => s.isActive && !s.isLost).toList()..sort((a, b) => a.sortOrder.compareTo(b.sortOrder)));

  factory Pipeline.fromJson(Map<String, dynamic> j) {
    final stages = j['stages'];
    return Pipeline(
      id: j['id']?.toString() ?? '',
      name: j['name']?.toString() ?? '',
      isDefault: j['is_default'] == true,
      stages: stages is List ? stages.whereType<Map<String, dynamic>>().map(Stage.fromJson).toList() : const [],
    );
  }
}

/// The pipeline new deals go to: the default one, else the first.
Pipeline? defaultPipeline(List<Pipeline> pipelines) {
  if (pipelines.isEmpty) return null;
  return pipelines.firstWhere((p) => p.isDefault, orElse: () => pipelines.first);
}

/// A lead source or a lost reason.
class CrmListItem {
  final String id;
  final String name;

  const CrmListItem({required this.id, required this.name});

  factory CrmListItem.fromJson(Map<String, dynamic> j) => CrmListItem(id: j['id']?.toString() ?? '', name: j['name']?.toString() ?? '');
}

// ── Activities ──────────────────────────────────────────────────────────────

const activityTypes = <(String, String)>[('call', 'Call'), ('meeting', 'Meeting'), ('email', 'Email'), ('visit', 'Visit'), ('todo', 'To-do')];

String activityTypeLabel(String t) => activityTypes.firstWhere((e) => e.$1 == t, orElse: () => (t, t)).$2;

class CrmActivity {
  final String id;
  final String activityType;
  final String subject;
  final String? notes;
  final DateTime dueAt;
  final int? durationMinutes;
  final String assignedTo;
  final String? assignedToName;
  final String? relatedType;
  final String? relatedId;
  final String? relatedName;
  final DateTime? doneAt;
  final String? outcome;

  const CrmActivity({
    required this.id,
    required this.activityType,
    required this.subject,
    this.notes,
    required this.dueAt,
    this.durationMinutes,
    required this.assignedTo,
    this.assignedToName,
    this.relatedType,
    this.relatedId,
    this.relatedName,
    this.doneAt,
    this.outcome,
  });

  factory CrmActivity.fromJson(Map<String, dynamic> j) => CrmActivity(
        id: j['id']?.toString() ?? '',
        activityType: j['activity_type']?.toString() ?? 'todo',
        subject: j['subject']?.toString() ?? '',
        notes: _str(j['notes']),
        dueAt: _date(j['due_at']) ?? DateTime.now(),
        durationMinutes: _numOrNull(j['duration_minutes'])?.toInt(),
        assignedTo: j['assigned_to']?.toString() ?? '',
        assignedToName: _str(j['assigned_to_name']),
        relatedType: _str(j['related_type']),
        relatedId: _str(j['related_id']),
        relatedName: _str(j['related_name']),
        doneAt: _date(j['done_at']),
        outcome: _str(j['outcome']),
      );
}

/// Where an activity falls for the person looking at it: done, overdue, today or upcoming.
String activityState(CrmActivity a, {DateTime? now}) {
  if (a.doneAt != null) return 'done';
  final at = now ?? DateTime.now();
  final start = DateTime(at.year, at.month, at.day);
  final end = start.add(const Duration(days: 1));
  if (a.dueAt.isBefore(start)) return 'overdue';
  if (a.dueAt.isBefore(end)) return a.dueAt.isBefore(at) ? 'overdue' : 'today';
  return 'upcoming';
}

class ActivitySummary {
  final int overdue;
  final int today;
  final int upcoming;

  const ActivitySummary({this.overdue = 0, this.today = 0, this.upcoming = 0});

  factory ActivitySummary.fromJson(Map<String, dynamic> j) =>
      ActivitySummary(overdue: _num(j['overdue']).toInt(), today: _num(j['today']).toInt(), upcoming: _num(j['upcoming']).toInt());
}

/// What the activity form sends (CreateActivityDto / UpdateActivityDto).
Map<String, dynamic> activityBody({
  required String activityType,
  required String subject,
  required DateTime dueAt,
  String notes = '',
  String? assignedTo,
  String? relatedType,
  String? relatedId,
}) =>
    {
      'activity_type': activityType,
      'subject': subject.trim(),
      'due_at': dueAt.toUtc().toIso8601String(),
      'notes': notes.trim().isEmpty ? null : notes.trim(),
      'assigned_to': ?assignedTo,
      if (relatedType != null && relatedId != null) ...{'related_type': relatedType, 'related_id': relatedId},
    };

// ── Follow-ups ──────────────────────────────────────────────────────────────

const followUpChannels = <(String, String)>[
  ('call', 'Call'), ('meeting', 'Meeting'), ('visit', 'Visit'), ('email', 'Email'),
  ('telegram', 'Telegram'), ('whatsapp', 'WhatsApp'), ('sms', 'SMS'), ('note', 'Note'),
];

String channelLabel(String? c) => c == null ? '' : followUpChannels.firstWhere((e) => e.$1 == c, orElse: () => (c, c)).$2;

/// A planned next step logged with a follow-up.
class NextStep {
  final String activityType;
  final String subject;
  final DateTime dueAt;
  final String? assignedTo;

  const NextStep({required this.activityType, required this.subject, required this.dueAt, this.assignedTo});
}

/// What the follow-up form sends (LogFollowUpDto). A note has no direction, length or person;
/// the time is sent only when it was changed (backdated).
Map<String, dynamic> followUpBody({
  required String channel,
  required String outcome,
  String direction = 'outbound',
  String duration = '',
  String withWhom = '',
  DateTime? occurredAt,
  NextStep? next,
  DateTime? now,
}) {
  final isNote = channel == 'note';
  final minutes = int.tryParse(duration.trim());
  final at = now ?? DateTime.now();
  return {
    'channel': channel,
    'outcome': outcome.trim(),
    if (!isNote) 'direction': direction,
    if (!isNote && minutes != null && minutes > 0) 'duration_minutes': minutes,
    if (!isNote && withWhom.trim().isNotEmpty) 'with_whom': withWhom.trim(),
    if (occurredAt != null && occurredAt.difference(at).inMinutes.abs() > 2) 'occurred_at': occurredAt.toUtc().toIso8601String(),
    if (next != null && !isNote)
      'next': {
        'activity_type': next.activityType,
        'subject': next.subject.trim(),
        'due_at': next.dueAt.toUtc().toIso8601String(),
        'assigned_to': ?next.assignedTo,
      },
  };
}

/// What is wrong with the follow-up form, or null.
String? followUpProblem({required String channel, required String outcome, DateTime? occurredAt, NextStep? next, DateTime? now}) {
  final at = now ?? DateTime.now();
  if (outcome.trim().isEmpty) return channel == 'note' ? 'Write the note' : 'Write what came out of it';
  if (occurredAt != null && occurredAt.isAfter(at.add(const Duration(minutes: 5)))) {
    return 'Log what already happened; plan future contacts as the next step';
  }
  if (next != null && channel != 'note' && next.subject.trim().isEmpty) return 'Write the next step, or switch it off';
  return null;
}

/// One logged contact or note (GET /crm/leads|opportunities/:id/follow-ups).
class FollowUpEvent {
  final String id;
  final String eventType;
  final String? summary;
  final String? channel;
  final String? direction;
  final String? outcome;
  final String? withWhom;
  final int? durationMinutes;
  final int? sequence;
  final DateTime? occurredAt;
  final String? createdByName;

  const FollowUpEvent({
    required this.id,
    required this.eventType,
    this.summary,
    this.channel,
    this.direction,
    this.outcome,
    this.withWhom,
    this.durationMinutes,
    this.sequence,
    this.occurredAt,
    this.createdByName,
  });

  factory FollowUpEvent.fromJson(Map<String, dynamic> j) {
    final p = j['payload'] is Map<String, dynamic> ? j['payload'] as Map<String, dynamic> : const <String, dynamic>{};
    return FollowUpEvent(
      id: j['id']?.toString() ?? '',
      eventType: j['event_type']?.toString() ?? '',
      summary: _str(j['summary']),
      channel: _str(p['channel']) ?? _str(p['kind']),
      direction: _str(p['direction']),
      outcome: _str(p['outcome']),
      withWhom: _str(p['with_whom']),
      durationMinutes: _numOrNull(p['duration_minutes'])?.toInt(),
      sequence: _numOrNull(p['sequence'])?.toInt(),
      occurredAt: _date(j['occurred_at']),
      createdByName: _str(j['created_by_name']),
    );
  }
}

class FollowUpPage {
  final List<FollowUpEvent> events;
  final String? nextCursor;

  const FollowUpPage({this.events = const [], this.nextCursor});

  factory FollowUpPage.fromJson(Map<String, dynamic> j) {
    final events = j['events'];
    return FollowUpPage(
      events: events is List ? events.whereType<Map<String, dynamic>>().map(FollowUpEvent.fromJson).toList() : const [],
      nextCursor: _str(j['nextCursor']),
    );
  }
}

/// "Telegram · 2 days ago" for a list; "Never contacted" when nobody has been in touch.
String lastContactText(DateTime? at, String? channel, {DateTime? now}) {
  if (at == null) return 'Never contacted';
  final days = (now ?? DateTime.now()).difference(at).inDays;
  final ago = days <= 0 ? 'today' : days == 1 ? 'yesterday' : '$days days ago';
  final how = channelLabel(channel);
  return how.isEmpty ? 'Contacted $ago' : '$how · $ago';
}

// ── Pages and filters ───────────────────────────────────────────────────────

class CrmPage<T> {
  final List<T> items;
  final int page;
  final int limit;
  final int total;
  final Map<String, int> counts;

  const CrmPage({this.items = const [], this.page = 1, this.limit = 40, this.total = 0, this.counts = const {}});

  factory CrmPage.fromJson(Map<String, dynamic> json, T Function(Map<String, dynamic>) item) {
    final data = json['data'];
    final meta = json['meta'] is Map<String, dynamic> ? json['meta'] as Map<String, dynamic> : const <String, dynamic>{};
    final counts = json['counts'] is Map<String, dynamic> ? json['counts'] as Map<String, dynamic> : const <String, dynamic>{};
    return CrmPage(
      items: data is List ? data.whereType<Map<String, dynamic>>().map(item).toList() : const [],
      page: _num(meta['page'] ?? 1).toInt(),
      limit: _num(meta['limit'] ?? 40).toInt(),
      total: _num(meta['total']).toInt(),
      counts: {for (final e in counts.entries) e.key: _num(e.value).toInt()},
    );
  }

  bool get hasMore => page * limit < total;

  CrmPage<T> append(CrmPage<T> next) =>
      CrmPage(items: [...items, ...next.items], page: next.page, limit: next.limit, total: next.total, counts: counts.isEmpty ? next.counts : counts);
}

/// The lead list filters; the key of the list provider, so equality matters.
class LeadQuery {
  final String q;

  /// 'open' (new, contacted, qualified), a status, or null for all.
  final String? status;
  final bool mine;

  const LeadQuery({this.q = '', this.status = 'open', this.mine = false});

  LeadQuery copyWith({String? q, String? status, bool clearStatus = false, bool? mine}) =>
      LeadQuery(q: q ?? this.q, status: clearStatus ? null : (status ?? this.status), mine: mine ?? this.mine);

  Map<String, dynamic> toParams(int page, int limit) => {
        if (q.trim().isNotEmpty) 'q': q.trim(),
        if (status != null) 'status': status,
        if (mine) 'owner_id': 'me',
        'page': page,
        'limit': limit,
      };

  @override
  bool operator ==(Object other) => other is LeadQuery && other.q == q && other.status == status && other.mine == mine;

  @override
  int get hashCode => Object.hash(q, status, mine);
}

class DealQuery {
  final String q;

  /// 'open', 'won', 'lost', or null for all.
  final String? status;
  final bool mine;

  /// 'overdue', 'no_activity' or 'stuck'.
  final String? attention;

  const DealQuery({this.q = '', this.status = 'open', this.mine = false, this.attention});

  DealQuery copyWith({String? q, String? status, bool clearStatus = false, bool? mine, String? attention, bool clearAttention = false}) => DealQuery(
        q: q ?? this.q,
        status: clearStatus ? null : (status ?? this.status),
        mine: mine ?? this.mine,
        attention: clearAttention ? null : (attention ?? this.attention),
      );

  Map<String, dynamic> toParams(int page, int limit) => {
        if (q.trim().isNotEmpty) 'q': q.trim(),
        if (status != null) 'status': status,
        if (mine) 'owner_id': 'me',
        if (attention != null) 'attention': attention,
        'page': page,
        'limit': limit,
      };

  @override
  bool operator ==(Object other) =>
      other is DealQuery && other.q == q && other.status == status && other.mine == mine && other.attention == attention;

  @override
  int get hashCode => Object.hash(q, status, mine, attention);
}

class ActivityQuery {
  /// 'overdue', 'today', 'upcoming', 'open' or 'done'.
  final String when;

  /// 'me', 'all' or a person.
  final String assignedTo;
  final String? relatedType;
  final String? relatedId;

  const ActivityQuery({this.when = 'open', this.assignedTo = 'me', this.relatedType, this.relatedId});

  Map<String, dynamic> toParams(int page, int limit) => {
        'when': when,
        'assigned_to': assignedTo,
        if (relatedType != null) 'related_type': relatedType,
        if (relatedId != null) 'related_id': relatedId,
        'page': page,
        'limit': limit,
      };

  @override
  bool operator ==(Object other) =>
      other is ActivityQuery && other.when == when && other.assignedTo == assignedTo && other.relatedType == relatedType && other.relatedId == relatedId;

  @override
  int get hashCode => Object.hash(when, assignedTo, relatedType, relatedId);
}
