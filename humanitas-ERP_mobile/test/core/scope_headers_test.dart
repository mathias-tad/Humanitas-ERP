import 'package:flutter_test/flutter_test.dart';

import '../../lib/core/api/scope_headers.dart';

void main() {
  tearDown(ScopeHeaders.clear);

  test('adds the picked company and branch to a request', () {
    ScopeHeaders.set({'x-company-id': 'c1', 'x-branch-id': 'b1'});
    final headers = <String, dynamic>{'Accept': 'application/json'};
    ScopeHeaders.applyTo(headers);
    expect(headers['x-company-id'], 'c1');
    expect(headers['x-branch-id'], 'b1');
  });

  test('keeps a company the request names itself', () {
    ScopeHeaders.set({'x-company-id': 'c1'});
    final headers = <String, dynamic>{'x-company-id': 'c2'};
    ScopeHeaders.applyTo(headers);
    expect(headers['x-company-id'], 'c2');
  });

  test('sends nothing after clear (sign-out)', () {
    ScopeHeaders.set({'x-company-id': 'c1'});
    ScopeHeaders.clear();
    final headers = <String, dynamic>{};
    ScopeHeaders.applyTo(headers);
    expect(headers, isEmpty);
  });
}
