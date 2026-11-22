/// Contacts: companies and people for every module (featureslist §4.1, CRM 1.3); mirrors GET /contacts.
String? _str(dynamic v) {
  if (v == null) return null;
  final s = v.toString();
  return s.isEmpty ? null : s;
}

double? _numOrNull(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse(v.toString()));

/// Ethiopian TIN: 10 digits (spaces and dashes are fine while typing).
String? tinProblem(String tin) {
  final d = tin.replaceAll(RegExp(r'[\s-]'), '');
  if (d.isEmpty) return null;
  return RegExp(r'^\d{10}$').hasMatch(d) ? null : 'A TIN is 10 digits';
}

class Contact {
  final String id;
  final String code;
  final String contactType;
  final String? parentId;
  final String? parentName;
  final bool isPrimaryContact;
  final String? jobTitle;
  final String name;
  final String? legalName;
  final String? tin;
  final String? vatNumber;
  final String? phone;
  final String? mobile;
  final String? email;
  final String? website;
  final String? region;
  final String? city;
  final String? subcity;
  final String? woreda;
  final String? street;
  final String? categoryId;
  final String? categoryName;
  final List<String> tags;
  final bool isCustomer;
  final bool isVendor;
  final String? priceListName;
  final double? creditLimit;
  final int paymentTermsDays;
  final String? accountManagerName;
  final String? notes;
  final bool isActive;
  final int peopleCount;
  final String? primaryContact;
  final List<Contact> people;

  const Contact({
    required this.id,
    required this.code,
    this.contactType = 'company',
    this.parentId,
    this.parentName,
    this.isPrimaryContact = false,
    this.jobTitle,
    required this.name,
    this.legalName,
    this.tin,
    this.vatNumber,
    this.phone,
    this.mobile,
    this.email,
    this.website,
    this.region,
    this.city,
    this.subcity,
    this.woreda,
    this.street,
    this.categoryId,
    this.categoryName,
    this.tags = const [],
    this.isCustomer = false,
    this.isVendor = false,
    this.priceListName,
    this.creditLimit,
    this.paymentTermsDays = 0,
    this.accountManagerName,
    this.notes,
    this.isActive = true,
    this.peopleCount = 0,
    this.primaryContact,
    this.people = const [],
  });

  bool get isCompany => contactType == 'company';

  /// "Abebe Trading", or "Sara · Abebe Trading" for a person at a company.
  String get label => parentName == null ? name : '$name · $parentName';

  String get address => [street, woreda, subcity, city, region].whereType<String>().where((s) => s.isNotEmpty).join(', ');

  factory Contact.fromJson(Map<String, dynamic> j) {
    final tags = j['tags'];
    final people = j['people'];
    return Contact(
      id: j['id']?.toString() ?? '',
      code: j['code']?.toString() ?? '',
      contactType: j['contact_type']?.toString() ?? 'company',
      parentId: _str(j['parent_id']),
      parentName: _str(j['parent_name']),
      isPrimaryContact: j['is_primary_contact'] == true,
      jobTitle: _str(j['job_title']),
      name: j['name']?.toString() ?? '',
      legalName: _str(j['legal_name']),
      tin: _str(j['tin']),
      vatNumber: _str(j['vat_number']),
      phone: _str(j['phone']),
      mobile: _str(j['mobile']),
      email: _str(j['email']),
      website: _str(j['website']),
      region: _str(j['region']),
      city: _str(j['city']),
      subcity: _str(j['subcity']),
      woreda: _str(j['woreda']),
      street: _str(j['street']),
      categoryId: _str(j['category_id']),
      categoryName: _str(j['category_name']),
      tags: tags is List ? tags.map((e) => e.toString()).toList() : const [],
      isCustomer: j['is_customer'] == true,
      isVendor: j['is_vendor'] == true,
      priceListName: _str(j['price_list_name']),
      creditLimit: _numOrNull(j['credit_limit']),
      paymentTermsDays: (_numOrNull(j['payment_terms_days']) ?? 0).toInt(),
      accountManagerName: _str(j['account_manager_name']),
      notes: _str(j['notes']),
      isActive: j['is_active'] != false,
      peopleCount: (_numOrNull(j['people_count']) ?? 0).toInt(),
      primaryContact: _str(j['primary_contact']),
      people: people is List ? people.whereType<Map<String, dynamic>>().map(Contact.fromJson).toList() : const [],
    );
  }
}

class ContactPage {
  final List<Contact> items;
  final int page;
  final int limit;
  final int total;

  const ContactPage({this.items = const [], this.page = 1, this.limit = 40, this.total = 0});

  factory ContactPage.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    final meta = json['meta'] is Map<String, dynamic> ? json['meta'] as Map<String, dynamic> : const <String, dynamic>{};
    return ContactPage(
      items: data is List ? data.whereType<Map<String, dynamic>>().map(Contact.fromJson).toList() : const [],
      page: (_numOrNull(meta['page']) ?? 1).toInt(),
      limit: (_numOrNull(meta['limit']) ?? 40).toInt(),
      total: (_numOrNull(meta['total']) ?? 0).toInt(),
    );
  }

  bool get hasMore => page * limit < total;

  ContactPage append(ContactPage next) =>
      ContactPage(items: [...items, ...next.items], page: next.page, limit: next.limit, total: next.total);
}

/// List filters; the key of the list provider, so equality matters.
class ContactQuery {
  final String q;

  /// null (everyone), 'customer' or 'vendor'.
  final String? role;
  final String status;

  const ContactQuery({this.q = '', this.role, this.status = 'active'});

  ContactQuery copyWith({String? q, String? role, bool clearRole = false, String? status}) =>
      ContactQuery(q: q ?? this.q, role: clearRole ? null : (role ?? this.role), status: status ?? this.status);

  Map<String, dynamic> toParams(int page, int limit) => {
        if (q.trim().isNotEmpty) 'q': q.trim(),
        if (role != null) 'role': role,
        'status': status,
        'page': page,
        'limit': limit,
      };

  @override
  bool operator ==(Object other) => other is ContactQuery && other.q == q && other.role == role && other.status == status;

  @override
  int get hashCode => Object.hash(q, role, status);
}

class ContactCategory {
  final String id;
  final String name;

  const ContactCategory({required this.id, required this.name});

  factory ContactCategory.fromJson(Map<String, dynamic> j) => ContactCategory(id: j['id']?.toString() ?? '', name: j['name']?.toString() ?? '');
}

class DuplicateContact {
  final String id;
  final String code;
  final String name;
  final String reason;

  const DuplicateContact({required this.id, required this.code, required this.name, required this.reason});

  factory DuplicateContact.fromJson(Map<String, dynamic> j) => DuplicateContact(
        id: j['id']?.toString() ?? '',
        code: j['code']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        reason: j['reason']?.toString() ?? '',
      );
}
