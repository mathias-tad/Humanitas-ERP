import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/routes/return_path.dart';

void main() {
  test('accepts the app own screens only', () {
    expect(safeReturnPath('/home'), '/home');
    expect(safeReturnPath('/home?tab=products'), '/home?tab=products');
    expect(safeReturnPath('/login'), isNull);
    expect(safeReturnPath('/splash'), isNull);
    expect(safeReturnPath('//evil.example.com'), isNull);
    expect(safeReturnPath('https://evil.example.com/home'), isNull);
    expect(safeReturnPath('/unknown'), isNull);
    expect(safeReturnPath(''), isNull);
    expect(safeReturnPath(null), isNull);
  });

  test('carries the destination through splash and sign-in', () {
    final toSplash = withReturn('/splash', Uri.parse('/home?tab=products'));
    expect(toSplash, '/splash?from=${Uri.encodeComponent('/home?tab=products')}');
    final toLogin = withReturn('/login', Uri.parse(toSplash));
    expect(toLogin, '/login?from=${Uri.encodeComponent('/home?tab=products')}');
    expect(returnPathFrom(Uri.parse(toLogin)), '/home?tab=products');
  });

  test('goes home when there is nothing to return to', () {
    expect(withReturn('/login', Uri.parse('/splash')), '/login');
    expect(returnPathFrom(Uri.parse('/login')), isNull);
  });
}
