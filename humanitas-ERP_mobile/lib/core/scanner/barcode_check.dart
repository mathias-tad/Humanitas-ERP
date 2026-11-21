/// Guards against camera misreads: a code is accepted only when its check digit is right
/// for its format and the camera reads it the same way twice in a row.
library;

/// GS1 check digit (EAN-8, UPC-A, EAN-13, ITF-14).
bool gs1CheckDigitOk(String code) {
  if (!RegExp(r'^\d{8}$|^\d{12,14}$').hasMatch(code)) return false;
  final digits = code.split('').map(int.parse).toList();
  final check = digits.removeLast();
  var sum = 0;
  var w = 3;
  for (var i = digits.length - 1; i >= 0; i--) {
    sum += digits[i] * w;
    w = w == 3 ? 1 : 3;
  }
  return (10 - sum % 10) % 10 == check;
}

/// Expands an 8-digit UPC-E code to UPC-A (null if it is not UPC-E).
String? upcEToUpcA(String code) {
  if (!RegExp(r'^[01]\d{7}$').hasMatch(code)) return null;
  final ns = code[0];
  final d = code.substring(1, 7);
  final check = code[7];
  final last = d[5];
  String body;
  if ('012'.contains(last)) {
    body = '${d.substring(0, 2)}${last}0000${d.substring(2, 5)}';
  } else if (last == '3') {
    body = '${d.substring(0, 3)}00000${d.substring(3, 5)}';
  } else if (last == '4') {
    body = '${d.substring(0, 4)}00000${d[4]}';
  } else {
    body = '${d.substring(0, 5)}0000$last';
  }
  return '$ns$body$check';
}

/// True when [code] is believable for [format] (a mobile_scanner `BarcodeFormat.name`).
bool isPlausibleRead(String code, String? format) {
  if (code.isEmpty) return false;
  final digitsOnly = RegExp(r'^\d+$').hasMatch(code);
  switch ((format ?? '').toLowerCase()) {
    case 'ean13':
      return code.length == 13 && digitsOnly && gs1CheckDigitOk(code);
    case 'ean8':
      return code.length == 8 && digitsOnly && gs1CheckDigitOk(code);
    case 'upca':
      return code.length == 12 && digitsOnly && gs1CheckDigitOk(code);
    case 'upce':
      final upcA = upcEToUpcA(code);
      return upcA != null && gs1CheckDigitOk(upcA);
    case 'itf':
    case 'itf14':
      return digitsOnly && code.length.isEven && code.length >= 6 && (code.length != 14 || gs1CheckDigitOk(code));
    case 'code39':
    case 'code128':
      return code.length >= 3;
    default:
      if (RegExp(r'^\d{8}$|^\d{12,13}$').hasMatch(code)) return gs1CheckDigitOk(code);
      return true;
  }
}

/// Confirms a code once it has been read the same way [required] times in a row.
class ReadConfirmer {
  final int required;
  final Duration window;
  String? _last;
  int _count = 0;
  DateTime? _at;

  ReadConfirmer({this.required = 2, this.window = const Duration(milliseconds: 1500)});

  /// Returns the code when confirmed, otherwise null.
  String? push(String code, [DateTime? now]) {
    final t = now ?? DateTime.now();
    if (code == _last && _at != null && t.difference(_at!) <= window) {
      _count++;
    } else {
      _last = code;
      _count = 1;
    }
    _at = t;
    return _count >= required ? code : null;
  }
}
