/** Helpers for reading caught values safely (`catch (err: unknown)`). */

/** The error's message; for non-Error values, their string form. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

/** The error's name (e.g. 'AbortError'), or undefined for non-Error values. */
export function errorName(err: unknown): string | undefined {
  if (err instanceof Error) return err.name;
  if (err && typeof err === 'object' && 'name' in err) {
    return String((err as { name: unknown }).name);
  }
  return undefined;
}
