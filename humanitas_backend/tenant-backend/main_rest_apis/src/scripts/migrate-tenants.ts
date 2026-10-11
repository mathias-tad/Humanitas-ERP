import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DatabaseService } from '../modules/database/database.service';

/**
 * CLI Migration Runner
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/migrate-tenants.ts
 * Or:
 *   npm run migrate:tenants
 *
 * Can also target a single tenant:
 *   npm run migrate:tenants -- --slug=my-tenant
 */
async function bootstrap() {
  console.log('\n' + '═'.repeat(70));
  console.log('🚀 HUMANITAS MULTI-TENANT MIGRATION & SEED RUNNER');
  console.log('═'.repeat(70) + '\n');

  // Parse optional --slug=xxx from command line arguments
  const slugArg = process.argv.find((arg) => arg.startsWith('--slug='));
  const targetSlug = slugArg ? slugArg.split('=')[1] : undefined;

  if (targetSlug) {
    console.log(`🎯 Targeting single tenant: ${targetSlug}\n`);
  } else {
    console.log('🌐 Targeting ALL registered tenants from master database\n');
  }

  // Create minimal application context without HTTP listener
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const databaseService = app.get(DatabaseService);

    // 1. Audit status before running
    console.log('📋 Checking current migration status...');
    const preStatuses = await databaseService.getMigrationStatus(targetSlug);
    for (const s of preStatuses) {
      console.log(
        `   • [${s.database}]: ${s.appliedCount}/${s.totalFiles} applied, ${s.pendingCount} pending`,
      );
      if (s.pending.length > 0) {
        console.log(`     ↳ Pending: ${s.pending.join(', ')}`);
      }
    }
    console.log('');

    // 2. Execute migration sweep
    console.log('⚙️  Applying pending migrations and non-destructive seeds...');
    const result = await databaseService.runManualMigration(targetSlug);

    console.log('\n' + '═'.repeat(70));
    console.log('📊 MIGRATION SUMMARY:');
    console.log('═'.repeat(70));

    for (const m of result.migrated) {
      if (m.applied.length > 0) {
        console.log(`   ✅ Tenant "${m.slug}": Applied ${m.applied.length} file(s) -> ${m.applied.join(', ')}`);
      } else {
        console.log(`   ✔ Tenant "${m.slug}": Up to date (no pending files)`);
      }
    }

    if (result.errors.length > 0) {
      console.error('\n⚠️  Errors encountered:');
      for (const err of result.errors) {
        console.error(`   ❌ Tenant "${err.tenant}": ${err.error}`);
      }
      console.log('\n' + '═'.repeat(70));
      await app.close();
      process.exit(1);
    }

    console.log('\n🎉 All tenant databases are up to date and in sync!\n' + '═'.repeat(70) + '\n');
    await app.close();
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Fatal migration error:', err.message);
    await app.close();
    process.exit(1);
  }
}

bootstrap();
