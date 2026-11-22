/// What the company/branch switcher may offer this user: GET /me/company-scope (AGENTS.md rule 16).
class ScopeBranch {
  final String id;
  final String name;
  final bool isDefault;

  const ScopeBranch({required this.id, required this.name, this.isDefault = false});

  factory ScopeBranch.fromJson(Map<String, dynamic> json) => ScopeBranch(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        isDefault: json['is_default'] == true,
      );
}

class ScopeCompany {
  final String id;
  final String name;
  final bool isDefault;

  /// The user may work in every branch of this company.
  final bool allBranches;
  final List<ScopeBranch> branches;

  const ScopeCompany({
    required this.id,
    required this.name,
    this.isDefault = false,
    this.allBranches = true,
    this.branches = const [],
  });

  factory ScopeCompany.fromJson(Map<String, dynamic> json) {
    final raw = json['branches'];
    return ScopeCompany(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      isDefault: json['is_default'] == true,
      allBranches: json['all_branches'] != false,
      branches: raw is List ? raw.whereType<Map<String, dynamic>>().map(ScopeBranch.fromJson).toList() : const [],
    );
  }
}

/// The companies and branches picked in the switcher. Empty = the user's default
/// (every company for users who see all companies).
class ScopeSelection {
  final List<String> companyIds;
  final List<String> branchIds;

  const ScopeSelection({this.companyIds = const [], this.branchIds = const []});

  static const none = ScopeSelection();

  bool get isEmpty => companyIds.isEmpty && branchIds.isEmpty;

  /// Sent with every API call.
  Map<String, String> get headers => {
        if (companyIds.isNotEmpty) 'x-company-id': companyIds.join(','),
        if (branchIds.isNotEmpty) 'x-branch-id': branchIds.join(','),
      };

  @override
  bool operator ==(Object other) =>
      other is ScopeSelection && _same(other.companyIds, companyIds) && _same(other.branchIds, branchIds);

  @override
  int get hashCode => Object.hash(Object.hashAll(companyIds), Object.hashAll(branchIds));

  static bool _same(List<String> a, List<String> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}

class CompanyScope {
  final bool allCompanies;
  final bool allBranches;
  final String? defaultCompanyId;
  final String? defaultBranchId;
  final List<ScopeCompany> companies;

  const CompanyScope({
    this.allCompanies = false,
    this.allBranches = false,
    this.defaultCompanyId,
    this.defaultBranchId,
    this.companies = const [],
  });

  factory CompanyScope.fromJson(Map<String, dynamic> json) {
    final raw = json['companies'];
    String? str(dynamic v) => v == null || v.toString().isEmpty ? null : v.toString();
    return CompanyScope(
      allCompanies: json['all_companies'] == true,
      allBranches: json['all_branches'] == true,
      defaultCompanyId: str(json['default_company_id']),
      defaultBranchId: str(json['default_branch_id']),
      companies: raw is List ? raw.whereType<Map<String, dynamic>>().map(ScopeCompany.fromJson).toList() : const [],
    );
  }

  ScopeCompany? company(String? id) {
    for (final c in companies) {
      if (c.id == id) return c;
    }
    return null;
  }

  /// The company a limited user works in when nothing is picked.
  ScopeCompany? get defaultCompany => company(defaultCompanyId) ?? (companies.isEmpty ? null : companies.first);

  /// More than one company or branch to choose from.
  bool get canSwitch => companies.length > 1 || companies.any((c) => c.branches.length > 1);

  /// The companies whose branches the picker offers for [companyIds].
  List<ScopeCompany> _companiesFor(List<String> companyIds) {
    if (companyIds.isNotEmpty) return companies.where((c) => companyIds.contains(c.id)).toList();
    if (allCompanies) return companies;
    final d = defaultCompany;
    return d == null ? const [] : [d];
  }

  /// Branches the picker offers for the chosen companies (nothing chosen: the default company,
  /// or every company for users who see all companies).
  List<ScopeBranch> branchesFor(List<String> companyIds) =>
      [for (final c in _companiesFor(companyIds)) ...c.branches];

  /// Keeps only companies and branches this user may use, and branches of the chosen companies.
  ScopeSelection sanitize(ScopeSelection s) {
    final companyIds = s.companyIds.where((id) => company(id) != null).toList();
    final allowed = branchesFor(companyIds).map((b) => b.id).toSet();
    final branchIds = s.branchIds.where(allowed.contains).toList();
    return ScopeSelection(companyIds: companyIds, branchIds: branchIds);
  }

  /// Text on the switcher button.
  String label(ScopeSelection s) {
    final sel = sanitize(s);
    final String companyText;
    if (sel.companyIds.isEmpty) {
      companyText = allCompanies ? 'All companies' : (defaultCompany?.name ?? 'My company');
    } else if (sel.companyIds.length == 1) {
      companyText = company(sel.companyIds.first)?.name ?? '1 company';
    } else {
      companyText = '${sel.companyIds.length} companies';
    }
    if (sel.branchIds.isEmpty) return companyText;
    if (sel.branchIds.length == 1) {
      final b = branchesFor(sel.companyIds).where((b) => b.id == sel.branchIds.first);
      return b.isEmpty ? '$companyText · 1 branch' : '$companyText · ${b.first.name}';
    }
    return '$companyText · ${sel.branchIds.length} branches';
  }
}
