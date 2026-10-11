/**
 * Shared SSL configuration helper for admin-backend PostgreSQL connections.
 * Hardened against MITM attacks by enforcing rejectUnauthorized: true by default,
 * while allowing optional CA certificate authority configuration.
 */
export function buildAdminSslConfig(options?: {
  dbUrl?: string;
  sslEnabled?: boolean;
  ca?: string;
  explicitReject?: string | boolean;
}): false | { rejectUnauthorized: boolean; ca?: string } {
  const dbUrl = options?.dbUrl || process.env.DATABASE_URL || '';
  const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const sslEnabled = options?.sslEnabled !== undefined
    ? options.sslEnabled
    : (process.env.DATABASE_SSL === 'true');

  if (isLocalhost || !sslEnabled) {
    return false;
  }

  const ca = options?.ca || process.env.DATABASE_SSL_CA;
  const explicitReject = options?.explicitReject !== undefined
    ? options.explicitReject
    : process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;

  // Defaults to true for secure TLS against MITM attacks unless explicitly set to 'false' / false
  const rejectUnauthorized = explicitReject === 'false' || explicitReject === false ? false : true;

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {}),
  };
}
