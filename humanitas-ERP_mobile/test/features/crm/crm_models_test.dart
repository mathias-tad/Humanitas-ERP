import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/features/crm/models/crm_models.dart';

void main() {
  test('reads a lead from GET /crm/leads/:id', () {
    final l = Lead.fromJson({
      'id': 'l1', 'code': 'L000001', 'title': '20 office chairs', 'person_name': 'Sara', 'company_name': 'Abebe Trading',
      'status': 'contacted', 'budget': '50000.00', 'expected_revenue': '42000', 'tags': ['VIP'], 'contact_count': 2,
      'last_contact_at': '2026-11-20T08:00:00.000Z', 'last_contact_channel': 'telegram', 'is_active': true,
    });
    expect(l.who, 'Sara · Abebe Trading');
    expect(l.isOpen, isTrue);
    expect(l.statusLabel, 'Contacted');
    expect(l.budget, 50000);
    expect(l.expectedRevenue, 42000);
    expect(l.contactCount, 2);
    expect(l.lastContactChannel, 'telegram');
    expect(const Lead(id: 'x', code: 'L2', title: 't').who, '—');
  });

  test('lead status moves follow the server rules', () {
    expect(leadStatusMoves('new'), ['contacted', 'qualified']);
    expect(leadStatusMoves('lost'), ['new', 'contacted', 'qualified']);
    expect(leadStatusMoves('converted'), isEmpty);
  });

  test('the lead form sends only the fields the server accepts, blanks as null', () {
    final body = leadBody(title: ' Chairs ', personName: 'Sara', budget: '1,500', email: '  ');
    expect(body['title'], 'Chairs');
    expect(body['person_name'], 'Sara');
    expect(body['email'], isNull);
    expect(body['budget'], 1500);
    expect(body.keys.toSet(), {
      'title', 'person_name', 'company_name', 'job_title', 'phone', 'mobile', 'email', 'city', 'source_id', 'need', 'budget',
      'timeline', 'decision_maker', 'expected_revenue', 'notes',
    });
    expect(leadFormProblem(title: ''), isNotNull);
    expect(leadFormProblem(title: 'x', email: 'not-an-email'), 'That email does not look right');
    expect(leadFormProblem(title: 'x', budget: '-5'), isNotNull);
    expect(leadFormProblem(title: 'x', email: 'sara@abebe.et', budget: '100'), isNull);
  });

  test('reads a deal and tells its health', () {
    final now = DateTime(2026, 11, 28, 10);
    Deal deal({String status = 'open', String? close, DateTime? next, bool stuck = false}) => Deal.fromJson({
          'id': 'd1', 'code': 'O000001', 'name': 'Chairs', 'pipeline_id': 'p1', 'stage_id': 's1', 'status': status,
          'expected_revenue': '42000.00', 'effective_probability': 40, 'weighted_revenue': 16800, 'contact_name': 'Abebe Trading',
          'person_name': 'Sara', 'expected_close_date': close, 'next_activity_at': next?.toUtc().toIso8601String(), 'is_stuck': stuck,
        });
    final d = deal(close: '2026-12-31T00:00:00.000Z', next: DateTime(2026, 11, 29, 9));
    expect(d.expectedCloseDate, '2026-12-31');
    expect(d.customer, 'Abebe Trading · Sara');
    expect(d.weightedRevenue, 16800);
    expect(dealHealth(d, now: now), DealHealth.onTrack);
    expect(dealHealth(deal(close: '2026-11-01', next: DateTime(2026, 11, 29)), now: now), DealHealth.late);
    expect(dealHealth(deal(next: DateTime(2026, 11, 27)), now: now), DealHealth.late);
    expect(dealHealth(deal(), now: now), DealHealth.attention);
    expect(dealHealth(deal(next: DateTime(2026, 11, 30), stuck: true), now: now), DealHealth.attention);
    expect(dealHealth(deal(status: 'won'), now: now), DealHealth.won);
    expect(dealHealth(deal(status: 'lost'), now: now), DealHealth.lost);
  });

  test('the deal form checks and sends its fields', () {
    expect(dealFormProblem(name: ''), 'Name the deal');
    expect(dealFormProblem(name: 'x', probability: '120'), 'Probability is between 0 and 100');
    final create = dealBody(name: 'Chairs', contactId: 'c1', expectedRevenue: '', probability: '', pipelineId: 'p1');
    expect(create['expected_revenue'], 0);
    expect(create['probability'], isNull);
    expect(create['pipeline_id'], 'p1');
    expect(create.containsKey('stage_id'), isFalse);
    final edit = dealBody(name: 'Chairs', expectedRevenue: '42,000', probability: '35');
    expect(edit['expected_revenue'], 42000);
    expect(edit['probability'], 35);
    expect(edit.containsKey('pipeline_id'), isFalse);
  });

  test('a pipeline offers its stages in order without the lost stage', () {
    final p = Pipeline.fromJson({
      'id': 'p1', 'name': 'Sales', 'is_default': true,
      'stages': [
        {'id': 's3', 'name': 'Won', 'sort_order': 3, 'is_won': true},
        {'id': 's1', 'name': 'New', 'sort_order': 1, 'probability': '10'},
        {'id': 's4', 'name': 'Lost', 'sort_order': 4, 'is_lost': true},
        {'id': 's2', 'name': 'Proposal', 'sort_order': 2, 'is_active': false},
      ],
    });
    expect(p.movableStages.map((s) => s.id), ['s1', 's3']);
    expect(p.stages.firstWhere((s) => s.id == 's1').probability, 10);
    expect(defaultPipeline([const Pipeline(id: 'a', name: 'A'), p])?.id, 'p1');
    expect(defaultPipeline(const []), isNull);
  });

  test('activities fall in overdue, today, upcoming or done', () {
    final now = DateTime(2026, 11, 28, 10);
    CrmActivity at(DateTime due, {DateTime? done}) => CrmActivity(id: 'a', activityType: 'call', subject: 's', dueAt: due, assignedTo: 'u', doneAt: done);
    expect(activityState(at(DateTime(2026, 11, 27, 9)), now: now), 'overdue');
    expect(activityState(at(DateTime(2026, 11, 28, 9)), now: now), 'overdue');
    expect(activityState(at(DateTime(2026, 11, 28, 15)), now: now), 'today');
    expect(activityState(at(DateTime(2026, 11, 29, 9)), now: now), 'upcoming');
    expect(activityState(at(DateTime(2026, 11, 27), done: DateTime(2026, 11, 27)), now: now), 'done');
    final body = activityBody(activityType: 'visit', subject: ' Visit the shop ', dueAt: DateTime.utc(2026, 12, 1, 6), relatedType: 'lead', relatedId: 'l1');
    expect(body['subject'], 'Visit the shop');
    expect(body['due_at'], '2026-12-01T06:00:00.000Z');
    expect(body['related_type'], 'lead');
    expect(body['notes'], isNull);
    expect(activityBody(activityType: 'todo', subject: 'x', dueAt: DateTime.utc(2026)).containsKey('related_type'), isFalse);
  });

  test('a follow-up sends direction, length and person only for a contact, and the time only when backdated', () {
    final now = DateTime(2026, 11, 28, 10);
    final call = followUpBody(
      channel: 'call', outcome: ' Wants a quote ', duration: '5', withWhom: 'Sara', occurredAt: now, now: now,
      next: NextStep(activityType: 'email', subject: 'Send the quote', dueAt: DateTime.utc(2026, 11, 29, 6)),
    );
    expect(call['outcome'], 'Wants a quote');
    expect(call['direction'], 'outbound');
    expect(call['duration_minutes'], 5);
    expect(call['with_whom'], 'Sara');
    expect(call.containsKey('occurred_at'), isFalse);
    expect((call['next'] as Map)['subject'], 'Send the quote');
    final note = followUpBody(channel: 'note', outcome: 'Prefers Telegram', duration: '5', withWhom: 'Sara', now: now,
        next: NextStep(activityType: 'call', subject: 'x', dueAt: now));
    expect(note.keys.toSet(), {'channel', 'outcome'});
    final backdated = followUpBody(channel: 'visit', outcome: 'Met', occurredAt: now.subtract(const Duration(days: 1)), now: now);
    expect(backdated.containsKey('occurred_at'), isTrue);
    expect(followUpProblem(channel: 'call', outcome: ''), 'Write what came out of it');
    expect(followUpProblem(channel: 'note', outcome: ''), 'Write the note');
    expect(followUpProblem(channel: 'call', outcome: 'x', occurredAt: now.add(const Duration(hours: 1)), now: now), isNotNull);
    expect(followUpProblem(channel: 'call', outcome: 'x', next: NextStep(activityType: 'call', subject: ' ', dueAt: now)), isNotNull);
  });

  test('reads follow-ups and pages', () {
    final page = FollowUpPage.fromJson({
      'events': [
        {'id': 'e1', 'event_type': 'interaction', 'occurred_at': '2026-11-27T07:00:00.000Z',
         'payload': {'channel': 'whatsapp', 'direction': 'inbound', 'outcome': 'Asked for prices', 'sequence': 2, 'duration_minutes': 3}},
      ],
      'nextCursor': 'abc',
    });
    final e = page.events.single;
    expect(e.channel, 'whatsapp');
    expect(e.sequence, 2);
    expect(e.durationMinutes, 3);
    expect(page.nextCursor, 'abc');
    expect(channelLabel('whatsapp'), 'WhatsApp');
    expect(lastContactText(null, null), 'Never contacted');
    expect(lastContactText(DateTime(2026, 11, 26), 'call', now: DateTime(2026, 11, 28, 10)), 'Call · 2 days ago');

    final leads = CrmPage<Lead>.fromJson({
      'data': [{'id': 'l1', 'code': 'L1', 'title': 'a'}],
      'meta': {'page': 1, 'limit': 1, 'total': 3},
      'counts': {'new': 2, 'lost': 1},
    }, Lead.fromJson);
    expect(leads.hasMore, isTrue);
    expect(leads.counts['new'], 2);
    final more = leads.append(CrmPage<Lead>.fromJson({'data': [{'id': 'l2', 'code': 'L2', 'title': 'b'}], 'meta': {'page': 2, 'limit': 1, 'total': 3}}, Lead.fromJson));
    expect(more.items.length, 2);
    expect(more.counts['new'], 2);
    expect(const LeadQuery(q: 'a') == const LeadQuery(q: 'a'), isTrue);
    expect(const LeadQuery(mine: true).toParams(1, 40)['owner_id'], 'me');
    expect(const DealQuery(attention: 'stuck').toParams(2, 40), {'status': 'open', 'attention': 'stuck', 'page': 2, 'limit': 40});
    expect(const ActivityQuery(when: 'today').toParams(1, 40), {'when': 'today', 'assigned_to': 'me', 'page': 1, 'limit': 40});
  });
}
