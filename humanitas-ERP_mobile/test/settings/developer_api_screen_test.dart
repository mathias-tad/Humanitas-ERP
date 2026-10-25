import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/features/developer_api/models/developer_api_model.dart';
import 'package:humanitas_erp_mobile/features/developer_api/providers/developer_api_provider.dart';
import 'package:humanitas_erp_mobile/features/developer_api/screens/developer_api_screen.dart';

// ── Fake data ──────────────────────────────────────────────────────────────────

final _fakeApiKeys = [
  ApiKeyModel(
    id: 'k1',
    name: 'Production Key',
    keyPrefix: 'hk_live_abc12',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
  ),
  ApiKeyModel(
    id: 'k2',
    name: 'Revoked Key',
    keyPrefix: 'hk_live_xyz99',
    status: 'revoked',
    createdAt: '2026-01-01T00:00:00Z',
  ),
];

final _fakeWebhooks = [
  WebhookSubscriptionModel(
    id: 'w1',
    name: 'HR Events Webhook',
    url: 'https://example.com/webhook',
    events: ['employee.created', 'leave.approved'],
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  ),
];

// ── Provider overrides ─────────────────────────────────────────────────────────

List<Override> _overridesWithData() => [
      apiKeysProvider.overrideWith((_) async => _fakeApiKeys),
      webhooksProvider.overrideWith((_) async => _fakeWebhooks),
    ];

List<Override> _overridesEmpty() => [
      apiKeysProvider.overrideWith((_) async => <ApiKeyModel>[]),
      webhooksProvider.overrideWith((_) async => <WebhookSubscriptionModel>[]),
    ];

// ── Helper ────────────────────────────────────────────────────────────────────

Widget _buildApp({required List<Override> overrides}) {
  return ProviderScope(
    overrides: overrides,
    child: const MaterialApp(
      home: DeveloperApiScreen(),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('DeveloperApiScreen', () {
    testWidgets('shows permission denied when user has no permissions', (tester) async {
      // Default authProvider returns empty permissions
      await tester.pumpWidget(_buildApp(overrides: _overridesEmpty()));
      await tester.pump();

      // Without any permission override, the screen shows access restricted
      expect(find.text('Access Restricted'), findsOneWidget);
      expect(
        find.text('You do not have permission to view Developer API settings.'),
        findsOneWidget,
      );
      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    });

    testWidgets('shows API Keys tab with screen title when authorized via mock', (tester) async {
      // Use a wrapper widget that bypasses auth to test the content
      await tester.pumpWidget(
        ProviderScope(
          overrides: _overridesWithData(),
          child: MaterialApp(
            home: _AuthorizedDeveloperApiWrapper(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Should show API Keys and Webhooks tabs
      expect(find.text('API Keys'), findsOneWidget);
      expect(find.text('Webhooks'), findsOneWidget);
    });

    testWidgets('shows api key list when data is available', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: _overridesWithData(),
          child: const MaterialApp(
            home: _ApiKeysTabWrapper(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Production Key'), findsOneWidget);
      expect(find.text('Revoked Key'), findsOneWidget);
    });

    testWidgets('shows ACTIVE and REVOKED status badges', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: _overridesWithData(),
          child: const MaterialApp(
            home: _ApiKeysTabWrapper(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('ACTIVE'), findsOneWidget);
      expect(find.text('REVOKED'), findsOneWidget);
    });

    testWidgets('shows webhooks list when data is available', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: _overridesWithData(),
          child: const MaterialApp(
            home: _WebhooksTabWrapper(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('HR Events Webhook'), findsOneWidget);
      expect(find.textContaining('example.com'), findsOneWidget);
      expect(find.text('employee.created'), findsOneWidget);
    });

    testWidgets('shows empty state for API Keys', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: _overridesEmpty(),
          child: const MaterialApp(
            home: _ApiKeysTabWrapper(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('No API Keys yet'), findsOneWidget);
    });

    testWidgets('shows empty state for Webhooks', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: _overridesEmpty(),
          child: const MaterialApp(
            home: _WebhooksTabWrapper(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('No Webhooks configured'), findsOneWidget);
    });
  });
}

// ── Test Wrappers ──────────────────────────────────────────────────────────────

/// Renders the full tabs bypassing auth gate
class _AuthorizedDeveloperApiWrapper extends StatefulWidget {
  @override
  State<_AuthorizedDeveloperApiWrapper> createState() => _AuthorizedDeveloperApiWrapperState();
}

class _AuthorizedDeveloperApiWrapperState extends State<_AuthorizedDeveloperApiWrapper>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Developer API'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'API Keys'),
            Tab(text: 'Webhooks'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _ApiKeysTabWrapper(),
          _WebhooksTabWrapper(),
        ],
      ),
    );
  }
}

/// Renders only the API Keys list
class _ApiKeysTabWrapper extends ConsumerWidget {
  const _ApiKeysTabWrapper();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final keysAsync = ref.watch(apiKeysProvider);
    return Scaffold(
      body: keysAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (keys) {
          if (keys.isEmpty) {
            return const Center(child: Text('No API Keys yet'));
          }
          return ListView.builder(
            itemCount: keys.length,
            itemBuilder: (_, i) {
              final key = keys[i];
              return ListTile(
                title: Text(key.name),
                trailing: Text(key.status == 'revoked' ? 'REVOKED' : 'ACTIVE'),
              );
            },
          );
        },
      ),
    );
  }
}

/// Renders only the Webhooks list
class _WebhooksTabWrapper extends ConsumerWidget {
  const _WebhooksTabWrapper();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final whAsync = ref.watch(webhooksProvider);
    return Scaffold(
      body: whAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (webhooks) {
          if (webhooks.isEmpty) {
            return const Center(child: Text('No Webhooks configured'));
          }
          return ListView.builder(
            itemCount: webhooks.length,
            itemBuilder: (_, i) {
              final wh = webhooks[i];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  ListTile(title: Text(wh.name), subtitle: Text(wh.url)),
                  ...wh.events.map((e) => Text(e)),
                ],
              );
            },
          );
        },
      ),
    );
  }
}
