import 'package:flutter_test/flutter_test.dart';
import '../../lib/features/organization/models/company_model.dart';
import '../../lib/features/organization/models/branch_model.dart';

void main() {
  group('Organization Models', () {
    test('CompanyModel parses from JSON correctly', () {
      final json = {
        'id': 'company-123',
        'name': 'Humanitas Enterprise Corp',
        'legal_name': 'Humanitas Global Ltd',
        'registration_number': 'REG-8899',
        'tax_number': 'TAX-001122',
        'industry': 'Software & IT',
        'city': 'San Francisco',
        'country': 'USA',
        'phone': '+1 555 0199',
        'email': 'corp@humanitas.io',
        'is_default': true,
        'is_active': true,
      };

      final company = CompanyModel.fromJson(json);

      expect(company.id, equals('company-123'));
      expect(company.name, equals('Humanitas Enterprise Corp'));
      expect(company.legalName, equals('Humanitas Global Ltd'));
      expect(company.industry, equals('Software & IT'));
      expect(company.city, equals('San Francisco'));
      expect(company.isDefault, isTrue);
      expect(company.isActive, isTrue);
    });

    test('BranchModel parses from JSON correctly', () {
      final json = {
        'id': 'branch-456',
        'company_id': 'company-123',
        'company_name': 'Humanitas Enterprise Corp',
        'name': 'Headquarters Branch',
        'code': 'HQ-01',
        'city': 'New York',
        'country': 'USA',
        'phone': '+1 555 0200',
        'email': 'ny-branch@humanitas.io',
        'is_default': true,
        'is_active': true,
      };

      final branch = BranchModel.fromJson(json);

      expect(branch.id, equals('branch-456'));
      expect(branch.companyId, equals('company-123'));
      expect(branch.companyName, equals('Humanitas Enterprise Corp'));
      expect(branch.name, equals('Headquarters Branch'));
      expect(branch.code, equals('HQ-01'));
      expect(branch.isDefault, isTrue);
      expect(branch.isActive, isTrue);
    });

    test('Locked state scoping evaluation', () {
      const canViewAllCompanies = false;
      const canViewAllBranches = false;
      const isLocked = !canViewAllCompanies && !canViewAllBranches;

      expect(isLocked, isTrue);
    });

    test('Admin full scope scoping evaluation', () {
      const canViewAllCompanies = true;
      const canViewAllBranches = true;
      const isLocked = !canViewAllCompanies && !canViewAllBranches;

      expect(isLocked, isFalse);
    });
  });
}
