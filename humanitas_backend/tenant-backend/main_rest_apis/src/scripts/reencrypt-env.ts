// Imported first by reencrypt-messages.ts so these are set before the app module loads:
// a one-off job must not start the boot migration sweep or cron jobs.
process.env.AUTO_MIGRATE_TENANTS_ON_BOOT = 'false';
process.env.ENABLE_CRON = 'false';
