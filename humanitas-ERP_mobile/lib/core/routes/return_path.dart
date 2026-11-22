/// Sign-in returns to the screen a link opened (AGENTS.md rule 24 item 22).
///
/// The app remembers where it was going in `?from=` while it shows the splash and sign-in
/// screens, and goes there after sign-in. Only the app's own screens are accepted.
const List<String> kReturnableRoutes = ['/home'];

const Set<String> _authRoutes = {'/splash', '/login', '/setup-account'};

/// [raw] when it is one of the app's own screens, otherwise null (outside addresses,
/// the sign-in screens and unknown paths are never returned to).
String? safeReturnPath(String? raw) {
  if (raw == null) return null;
  final value = raw.trim();
  if (value.isEmpty || !value.startsWith('/') || value.startsWith('//') || value.contains('\\')) return null;
  final uri = Uri.tryParse(value);
  if (uri == null || uri.hasScheme || uri.hasAuthority) return null;
  final path = uri.path;
  if (_authRoutes.contains(path)) return null;
  final known = kReturnableRoutes.any((r) => path == r || path.startsWith('$r/'));
  return known ? value : null;
}

/// [target] (the splash or sign-in screen) carrying where the user was going.
String withReturn(String target, Uri current) {
  final from = safeReturnPath(current.queryParameters['from']) ?? safeReturnPath(current.toString());
  return from == null ? target : '$target?from=${Uri.encodeComponent(from)}';
}

/// Where to go after sign-in, or null for the home screen.
String? returnPathFrom(Uri current) => safeReturnPath(current.queryParameters['from']);
