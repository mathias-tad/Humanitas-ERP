import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:humanitas_erp_mobile/core/modules/module_manifest.dart';

void main() {
  test('matches the server module map', () {
    final server = File('../humanitas_backend/tenant-backend/main_rest_apis/src/common/modules/module-manifest.ts').readAsStringSync();
    final entries = RegExp(r"\{ key: '([a-z]+)', label: '[^']*', depends: \[([^\]]*)\] \}")
        .allMatches(server)
        .map((m) => '${m.group(1)}:${RegExp(r"'([a-z]+)'").allMatches(m.group(2)!).map((d) => d.group(1)).join(',')}')
        .toList();
    expect(entries, isNotEmpty);
    expect(moduleManifest.map((m) => '${m.key}:${m.depends.join(',')}').toList(), entries);
  });

  test('a module brings its bases along', () {
    expect(dependenciesOf('inventory'), ['products']);
    expect(dependentsOf('products'), containsAll(['inventory', 'sales', 'purchasing', 'pos']));
    expect(dependentsOf('contacts'), containsAll(['crm', 'sales', 'pos', 'accounting', 'purchasing', 'ecommerce', 'delivery']));
  });
}
