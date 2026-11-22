import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/contacts/models/contact_models.dart';

void main() {
  test('reads a company with its people from GET /contacts/:id', () {
    final c = Contact.fromJson({
      'id': 'c1', 'code': 'C000001', 'contact_type': 'company', 'name': 'Abebe Trading', 'tin': '0012345678', 'is_customer': true,
      'credit_limit': '50000.00', 'payment_terms_days': 30, 'tags': ['VIP'], 'city': 'Addis Ababa', 'subcity': 'Bole',
      'people': [
        {'id': 'p1', 'code': 'C000002', 'contact_type': 'person', 'name': 'Sara', 'parent_id': 'c1', 'parent_name': 'Abebe Trading', 'is_primary_contact': true},
      ],
    });
    expect(c.isCompany, isTrue);
    expect(c.isCustomer, isTrue);
    expect(c.creditLimit, 50000);
    expect(c.paymentTermsDays, 30);
    expect(c.address, 'Bole, Addis Ababa');
    expect(c.people.single.label, 'Sara · Abebe Trading');
    expect(c.people.single.isPrimaryContact, isTrue);
  });

  test('checks an Ethiopian TIN as it is typed', () {
    expect(tinProblem(''), isNull);
    expect(tinProblem('0012 345-678'), isNull);
    expect(tinProblem('12345'), 'A TIN is 10 digits');
  });

  test('pages append and filters compare by value', () {
    const a = ContactPage(items: [Contact(id: '1', code: 'C1', name: 'A')], page: 1, limit: 1, total: 2);
    final b = a.append(const ContactPage(items: [Contact(id: '2', code: 'C2', name: 'B')], page: 2, limit: 1, total: 2));
    expect(a.hasMore, isTrue);
    expect(b.items.map((c) => c.id), ['1', '2']);
    expect(b.hasMore, isFalse);
    expect(const ContactQuery(role: 'customer'), const ContactQuery(role: 'customer'));
    expect(const ContactQuery(role: 'customer').copyWith(clearRole: true).role, isNull);
  });

  test('contacts open with any module that has customers or vendors', () {
    for (final m in ['crm', 'sales', 'pos', 'accounting', 'purchasing', 'ecommerce', 'delivery']) {
      expect(AuthState(enabledFeatures: [m]).isModuleSubscribed('contacts'), isTrue, reason: m);
    }
    expect(AuthState(enabledFeatures: ['hrms', 'products']).isModuleSubscribed('contacts'), isFalse);
  });
}
