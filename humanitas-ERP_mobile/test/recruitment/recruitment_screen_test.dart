import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/recruitment/models/recruitment_models.dart';
import 'package:humanitas_erp_mobile/features/recruitment/providers/recruitment_provider.dart';
import 'package:humanitas_erp_mobile/features/recruitment/screens/recruitment_screen.dart';

// ── Sample Mock Data ─────────────────────────────────────────────────────────

const _sampleJobs = <JobPostModel>[
  JobPostModel(
    id: 'job-1',
    title: 'Senior Flutter Developer',
    department: 'Engineering',
    location: 'Remote',
    status: 'open',
    applicationsCount: 5,
  ),
];

const _sampleApplications = <CandidateApplicationModel>[
  CandidateApplicationModel(
    id: 'app-1',
    jobId: 'job-1',
    candidateName: 'Alice Smith',
    candidateEmail: 'alice@example.com',
    jobTitle: 'Senior Flutter Developer',
    status: 'screened',
    stage: 'screened',
    aiScore: 92.0,
    experienceYears: 4.5,
  ),
];

final _sampleInterviews = <InterviewModel>[
  InterviewModel(
    id: 'int-1',
    candidateId: 'app-1',
    candidateName: 'Alice Smith',
    jobTitle: 'Senior Flutter Developer',
    interviewerName: 'Tech Lead',
    scheduledAt: DateTime(2026, 11, 1, 14, 0),
    interviewType: 'Technical',
    meetingLink: 'https://meet.google.com/test-link',
    status: 'scheduled',
  ),
];

const _fakeFunnel = RecruitmentFunnelModel(
  applied: 20,
  screened: 12,
  interview: 6,
  offer: 3,
  hired: 2,
);

final _adminUser = UserModel(
  id: 'u1',
  email: 'admin@example.com',
  role: 'admin',
);

final _employeeUser = UserModel(
  id: 'u2',
  email: 'employee@example.com',
  role: 'employee',
);

// ── Auth Notifier Mock ───────────────────────────────────────────────────────

AuthState _adminAuthState() => AuthState(
      status: AuthStatus.authenticated,
      user: _adminUser,
      permissions: const [],
    );

AuthState _noPermAuthState() => AuthState(
      status: AuthStatus.authenticated,
      user: _employeeUser,
      permissions: const [],
    );

extension on AuthNotifier {
  void hackState(AuthState s) => state = s;
}

AuthNotifier _buildNotifier(AuthState initialState) {
  final storage = SecureStorageService();
  final apiClient = ApiClient(storage);
  final repo = AuthRepository(apiClient, storage);
  return AuthNotifier(repo)..hackState(initialState);
}

// ── Widget Builder ───────────────────────────────────────────────────────────

Widget _buildTestApp({
  required AuthState authState,
  List<JobPostModel>? initialJobs,
  List<CandidateApplicationModel>? initialApplications,
  List<InterviewModel>? initialInterviews,
  RecruitmentFunnelModel? initialFunnel,
}) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith((ref) => _buildNotifier(authState)),
      recruitmentJobsProvider.overrideWith((ref) => Future.value(initialJobs ?? _sampleJobs)),
      recruitmentApplicationsProvider.overrideWith((ref) => Future.value(initialApplications ?? _sampleApplications)),
      recruitmentInterviewsProvider.overrideWith((ref) => Future.value(initialInterviews ?? _sampleInterviews)),
      recruitmentFunnelProvider.overrideWith((ref) => Future.value(initialFunnel ?? _fakeFunnel)),
    ],
    child: MaterialApp(
      home: RecruitmentScreen(
        initialJobs: initialJobs,
        initialApplications: initialApplications,
        initialInterviews: initialInterviews,
        initialFunnel: initialFunnel,
      ),
    ),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

void main() {
  group('RecruitmentScreen Widget Tests', () {
    testWidgets('Permission denied UI for unauthorized role', (tester) async {
      await tester.pumpWidget(_buildTestApp(authState: _noPermAuthState()));
      await tester.pumpAndSettle();

      expect(find.text('Access Denied'), findsOneWidget);
      expect(
        find.text('You do not have permission to access Recruitment & ATS.'),
        findsOneWidget,
      );
      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    });

    testWidgets('Authorized user renders "Recruitment & ATS" title', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          authState: _adminAuthState(),
          initialJobs: _sampleJobs,
          initialApplications: _sampleApplications,
          initialInterviews: _sampleInterviews,
          initialFunnel: _fakeFunnel,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Recruitment & ATS'), findsOneWidget);
      expect(find.text('Pipeline'), findsOneWidget);
      expect(find.text('Interviews'), findsOneWidget);
      expect(find.text('Analytics'), findsOneWidget);
    });

    testWidgets('Tab navigation (Pipeline, Interviews, Analytics) renders correctly', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          authState: _adminAuthState(),
          initialJobs: _sampleJobs,
          initialApplications: _sampleApplications,
          initialInterviews: _sampleInterviews,
          initialFunnel: _fakeFunnel,
        ),
      );
      await tester.pumpAndSettle();

      // 1. Pipeline Tab checks
      expect(find.text('Alice Smith'), findsOneWidget);
      expect(find.text('Schedule Interview'), findsOneWidget);
      expect(find.text('Hire'), findsOneWidget);

      // 2. Navigate to Interviews Tab
      final interviewsTab = find.text('Interviews');
      expect(interviewsTab, findsOneWidget);
      await tester.tap(interviewsTab);
      await tester.pumpAndSettle();

      expect(find.text('Interviewer: Tech Lead'), findsOneWidget);
      expect(find.text('https://meet.google.com/test-link'), findsOneWidget);

      // 3. Navigate to Analytics Tab
      final analyticsTab = find.text('Analytics');
      expect(analyticsTab, findsOneWidget);
      await tester.tap(analyticsTab);
      await tester.pumpAndSettle();

      expect(find.text('Recruitment Funnel Overview'), findsOneWidget);
      expect(find.text('Overall Conversion Rate'), findsOneWidget);
      expect(find.text('Funnel Conversion Stages'), findsOneWidget);
      expect(find.text('Applied'), findsOneWidget);
      expect(find.text('Screened'), findsOneWidget);
      expect(find.text('Interview'), findsOneWidget);
      expect(find.text('Offer'), findsOneWidget);
      expect(find.text('Hired'), findsOneWidget);
    });
  });
}
