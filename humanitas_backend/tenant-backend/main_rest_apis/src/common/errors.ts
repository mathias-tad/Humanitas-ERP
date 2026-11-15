/** Helpers for reading caught values safely (`catch (err: unknown)`). */

/** The error's message; for non-Error values, their string form. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

/** The stack trace, when the caught value is an Error. */
export function errorStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined;
}

/** A driver/system error code such as Postgres '23505' or Node 'ENOENT'. */
export function errorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: unknown }).code;
    return code == null ? undefined : String(code);
  }
  return undefined;
}
