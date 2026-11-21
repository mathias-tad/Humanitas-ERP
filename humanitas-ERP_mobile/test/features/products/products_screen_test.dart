import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/products/models/product_models.dart';
import 'package:humanitas_erp_mobile/features/products/providers/products_providers.dart';
import 'package:humanitas_erp_mobile/features/products/repositories/products_repository.dart';
import 'package:humanitas_erp_mobile/features/products/screens/products_screen.dart';

class _TestAuth extends AuthNotifier {
  _TestAuth(AuthState initial) : super(AuthRepository(ApiClient(SecureStorageService()), SecureStorageService())) {
    state = initial;
  }
}

class _FakeProductsRepository extends ProductsRepository {
  final List<Product> products;
  final List<ProductQuery> queries = [];

  _FakeProductsRepository(this.products) : super(ApiClient(SecureStorageService()));

  @override
  Future<ProductPage> listProducts(ProductQuery query) async {
    queries.add(query);
    final term = query.q.trim().toLowerCase();
    final rows = products.where((p) => term.isEmpty || p.name.toLowerCase().contains(term)).toList();
    return ProductPage(items: rows, page: 1, limit: query.limit, total: rows.length);
  }
}

const _ready = Product(
  id: 'p1',
  name: 'Teff flour 1kg',
  itemCode: 'P0000001',
  uomId: 'kg',
  uomName: 'kg',
  uomSymbol: 'kg',
  uomMorCode: 'KLG',
  purchaseUomId: 'kg',
  salesPrice: 120,
  eimsReady: true,
);

const _notReady = Product(
  id: 'p2',
  name: 'Eggs (dozen)',
  itemCode: 'P0000002',
  uomId: 'dz',
  uomName: 'Dozen',
  purchaseUomId: 'dz',
  salesPrice: 95,
  eimsIssues: ['unit'],
);

AuthState _auth({String role = 'employee', List<String> permissions = const [], List<String> features = const ['products']}) =>
    AuthState(
      status: AuthStatus.authenticated,
      user: UserModel(id: 'u1', email: 'user@example.com', role: role),
      permissions: permissions,
      enabledFeatures: features,
    );

Future<_FakeProductsRepository> _pump(WidgetTester tester, AuthState auth, {List<Product> products = const [_ready, _notReady]}) async {
  final repo = _FakeProductsRepository(products);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authProvider.overrideWith((ref) => _TestAuth(auth)),
        productsRepositoryProvider.overrideWithValue(repo),
      ],
      child: const MaterialApp(home: ProductsScreen()),
    ),
  );
  await tester.pumpAndSettle();
  return repo;
}

void main() {
  testWidgets('denies access without view_products', (tester) async {
    await _pump(tester, _auth());
    expect(find.text('Access denied'), findsOneWidget);
    expect(find.text('Teff flour 1kg'), findsNothing);
  });

  testWidgets('denies access when the company has no Products module', (tester) async {
    await _pump(tester, _auth(role: 'admin', features: const ['hrms']));
    expect(find.text('Access denied'), findsOneWidget);
  });

  testWidgets('lists products with e-invoicing readiness; no create button without create_products', (tester) async {
    await _pump(tester, _auth(permissions: const ['view_products']));
    expect(find.text('Teff flour 1kg'), findsOneWidget);
    expect(find.text('Eggs (dozen)'), findsOneWidget);
    // List tiles merge their icons' labels into the row, so look for the icons themselves.
    expect(find.byIcon(Icons.verified_rounded), findsOneWidget);
    expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
    expect(find.text('New product'), findsNothing);
  });

  testWidgets('shows New product with create_products', (tester) async {
    await _pump(tester, _auth(permissions: const ['view_products', 'create_products']));
    expect(find.text('New product'), findsOneWidget);
  });

  testWidgets('searches and offers to create what was not found', (tester) async {
    final repo = await _pump(tester, _auth(permissions: const ['view_products', 'create_products']));
    await tester.enterText(find.byType(TextField), 'buna');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(repo.queries.last.q, 'buna');
    expect(find.text('No products match "buna".'), findsOneWidget);
    expect(find.text('Create "buna"'), findsOneWidget);
  });

  testWidgets('filters to products that need an e-invoicing fix', (tester) async {
    final repo = await _pump(tester, _auth(role: 'admin'));
    await tester.tap(find.text('Needs e-invoicing fix'));
    await tester.pumpAndSettle();
    expect(repo.queries.last.eims, 'not_ready');
  });
}
