import 'package:flutter_test/flutter_test.dart';

import '../../lib/features/organization/models/company_scope.dart';

CompanyScope _limited() => CompanyScope.fromJson({
      'all_companies': false,
      'all_branches': false,
      'default_company_id': 'c1',
      'default_branch_id': 'b1',
      'companies': [
        {
          'id': 'c1',
          'name': 'Addis Trading',
          'is_default': true,
          'all_branches': false,
          'branches': [
            {'id': 'b1', 'name': 'Bole', 'is_default': true},
            {'id': 'b2', 'name': 'Piassa'},
          ],
        },
        {'id': 'c2', 'name': 'Hawassa Foods', 'all_branches': true, 'branches': []},
      ],
    });

void main() {
  test('reads GET /me/company-scope', () {
    final s = _limited();
    expect(s.allCompanies, isFalse);
    expect(s.companies, hasLength(2));
    expect(s.defaultCompany?.name, 'Addis Trading');
    expect(s.companies.first.branches.map((b) => b.name), ['Bole', 'Piassa']);
    expect(s.canSwitch, isTrue);
  });

  test('a user with one company and one branch cannot switch', () {
    final s = CompanyScope.fromJson({
      'companies': [
        {'id': 'c1', 'name': 'Addis Trading', 'branches': [{'id': 'b1', 'name': 'Bole'}]},
      ],
    });
    expect(s.canSwitch, isFalse);
    expect(s.label(ScopeSelection.none), 'Addis Trading');
  });

  test('labels the default, one company, a branch and several companies', () {
    final s = _limited();
    expect(s.label(ScopeSelection.none), 'Addis Trading');
    expect(s.label(const ScopeSelection(companyIds: ['c2'])), 'Hawassa Foods');
    expect(s.label(const ScopeSelection(companyIds: ['c1'], branchIds: ['b2'])), 'Addis Trading · Piassa');
    expect(s.label(const ScopeSelection(companyIds: ['c1', 'c2'])), '2 companies');
    expect(const CompanyScope(allCompanies: true, companies: [ScopeCompany(id: 'c1', name: 'A')]).label(ScopeSelection.none),
        'All companies');
  });

  test('drops companies and branches the user may not use', () {
    final s = _limited();
    final clean = s.sanitize(const ScopeSelection(companyIds: ['c1', 'cX'], branchIds: ['b2', 'bX']));
    expect(clean.companyIds, ['c1']);
    expect(clean.branchIds, ['b2']);
    // A branch of a company that is not picked is dropped too.
    expect(s.sanitize(const ScopeSelection(companyIds: ['c2'], branchIds: ['b1'])).branchIds, isEmpty);
  });

  test('sends the selection as headers, nothing when empty', () {
    expect(const ScopeSelection(companyIds: ['c1', 'c2'], branchIds: ['b1']).headers,
        {'x-company-id': 'c1,c2', 'x-branch-id': 'b1'});
    expect(ScopeSelection.none.headers, isEmpty);
  });
}
