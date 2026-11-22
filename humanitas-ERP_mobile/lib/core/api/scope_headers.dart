/// The company and branch picked in the switcher, sent with every API call as
/// `x-company-id` / `x-branch-id` (AGENTS.md rule 16). The server checks them against the
/// user's access and, when nothing is picked, uses the user's default company and branch.
class ScopeHeaders {
  ScopeHeaders._();

  static Map<String, String> _current = const {};

  static Map<String, String> get current => _current;

  static void set(Map<String, String> headers) => _current = Map.unmodifiable(headers);

  static void clear() => _current = const {};

  /// Adds the headers, unless the request already names a company or branch itself.
  static void applyTo(Map<String, dynamic> headers) {
    _current.forEach((key, value) => headers.putIfAbsent(key, () => value));
  }
}
