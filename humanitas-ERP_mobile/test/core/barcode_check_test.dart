import 'package:flutter_test/flutter_test.dart';
import 'package:humanitas_erp_mobile/core/scanner/barcode_check.dart';

void main() {
  test('check digits', () {
    expect(gs1CheckDigitOk('6291041500213'), isTrue);
    expect(gs1CheckDigitOk('96385074'), isTrue);
    expect(gs1CheckDigitOk('036000291452'), isTrue);
    expect(gs1CheckDigitOk('6291041500214'), isFalse);
    expect(upcEToUpcA('04252614'), '042100005264');
  });

  test('plausible reads per format', () {
    expect(isPlausibleRead('6291041500213', 'ean13'), isTrue);
    expect(isPlausibleRead('6291041500214', 'ean13'), isFalse);
    expect(isPlausibleRead('04252614', 'upcE'), isTrue);
    expect(isPlausibleRead('1041', 'itf'), isFalse);
    expect(isPlausibleRead('SKU-001', 'code128'), isTrue);
    expect(isPlausibleRead('https://example.com', 'qrCode'), isTrue);
  });

  test('a code must be read the same way twice in a row', () {
    final c = ReadConfirmer();
    final t0 = DateTime(2026);
    expect(c.push('111', t0), isNull);
    expect(c.push('112', t0.add(const Duration(milliseconds: 100))), isNull);
    expect(c.push('112', t0.add(const Duration(milliseconds: 200))), '112');
    final slow = ReadConfirmer();
    slow.push('9', t0);
    expect(slow.push('9', t0.add(const Duration(seconds: 3))), isNull);
  });
}
