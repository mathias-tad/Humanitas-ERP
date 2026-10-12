import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:humanitas_erp_mobile/features/org_chart/models/org_node_model.dart';
import 'package:humanitas_erp_mobile/features/org_chart/repositories/org_chart_repository.dart';
import 'package:humanitas_erp_mobile/features/org_chart/screens/org_chart_screen.dart';

class FakeOrgChartRepository implements OrgChartRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<Map<String, dynamic>> getOrgChart({String? department}) async {
    return {
      'totalEmployees': 2,
      'rootCount': 1,
      'departments': ['Engineering', 'Executive'],
      'rootNodes': [
        OrgNodeModel(
          id: 'ceo-1',
          fullName: 'Alice CEO',
          email: 'alice@example.com',
          role: 'owner',
          position: 'CEO',
          department: 'Executive',
          directReportsCount: 1,
          teamCount: 1,
          children: [
            OrgNodeModel(
              id: 'dev-1',
              fullName: 'Bob Developer',
              email: 'bob@example.com',
              role: 'employee',
              position: 'Lead Dev',
              department: 'Engineering',
              directReportsCount: 0,
              teamCount: 0,
            ),
          ],
        ),
      ],
    };
  }

  @override
  Future<Map<String, dynamic>> getReportingChain(String userId) async {
    return {
      'user': OrgNodeModel(
        id: 'dev-1',
        fullName: 'Bob Developer',
        email: 'bob@example.com',
        role: 'employee',
        position: 'Lead Dev',
        department: 'Engineering',
        directReportsCount: 0,
        teamCount: 0,
      ),
      'ancestors': [
        OrgNodeModel(
          id: 'ceo-1',
          fullName: 'Alice CEO',
          email: 'alice@example.com',
          role: 'owner',
          position: 'CEO',
          department: 'Executive',
          directReportsCount: 1,
          teamCount: 1,
        ),
      ],
      'directReports': <OrgNodeModel>[],
    };
  }
}

void main() {
  testWidgets('OrgChartScreen displays title, members count, and employee cards', (WidgetTester tester) async {
    final fakeRepo = FakeOrgChartRepository();

    await tester.pumpWidget(
      MaterialApp(
        home: OrgChartScreen(repository: fakeRepo),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Org Chart'), findsOneWidget);
    expect(find.text('2 Team Members'), findsOneWidget);
    expect(find.text('Alice CEO'), findsOneWidget);
  });
}
