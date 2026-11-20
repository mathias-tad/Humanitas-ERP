import './reencrypt-env';
import { NestFactory } from '@nestjs/core';
import type { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { DatabaseService } from '../modules/database/database.service';
import { MessageEncryptionService } from '../modules/messaging/encryption/message-encryption.service';

/**
 * Re-encrypt chat messages that are still on a previous MESSAGE_ENCRYPTION_KEY.
 *
 * Dry run (default, read-only):
 *   docker compose exec tenant-api node dist/scripts/reencrypt-messages.js
 * Write changes:
 *   docker compose exec tenant-api node dist/scripts/reencrypt-messages.js --apply
 * Single tenant:
 *   ... reencrypt-messages.js --slug=my-tenant [--apply]
 *
 * Requires MESSAGE_ENCRYPTION_KEY (new key) and MESSAGE_ENCRYPTION_PREVIOUS_KEYS (old keys).
 * Safe to re-run: messages already on the current key are skipped. Each row is updated only
 * if it has not changed since it was read.
 */
const BATCH = 500;

type Counts = { scanned: number; current: number; moved: number; plain: number; unreadable: number };

async function bootstrap() {
  const apply = process.argv.includes('--apply');
  const slugArg = process.argv.find((a) => a.startsWith('--slug='));
  const targetSlug = slugArg ? slugArg.split('=')[1] : undefined;

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  let exitCode = 0;
  try {
    const db = app.get(DatabaseService);
    const enc = app.get(MessageEncryptionService, { strict: false });

    console.log(`Mode: ${apply ? 'APPLY (writes changes)' : 'DRY RUN (read-only)'}`);
    console.log(`Previous keys configured: ${enc.previousKeyCount}`);
    if (enc.previousKeyCount === 0) {
      console.log('Note: MESSAGE_ENCRYPTION_PREVIOUS_KEYS is empty, so nothing can be moved; this run only checks readability.');
    }

    let tenants = await db.getAllTenants();
    if (targetSlug) tenants = tenants.filter((t) => t.slug === targetSlug);
    if (targetSlug && tenants.length === 0) throw new Error(`Tenant not found: ${targetSlug}`);

    const total: Counts = { scanned: 0, current: 0, moved: 0, plain: 0, unreadable: 0 };
    for (const t of tenants) {
      try {
        const conn: DataSource = await db.getTenantConnection(t.database_name);
        const c = await processTenant(conn, enc, apply);
        (Object.keys(total) as (keyof Counts)[]).forEach((k) => (total[k] += c[k]));
        console.log(
          `[${t.slug}] scanned=${c.scanned} current=${c.current} ${apply ? 'moved' : 'to_move'}=${c.moved} plain=${c.plain} unreadable=${c.unreadable}`,
        );
        if (c.unreadable > 0) exitCode = 2;
      } catch (err) {
        exitCode = 1;
        console.error(`[${t.slug}] ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    console.log(
      `TOTAL scanned=${total.scanned} current=${total.current} ${apply ? 'moved' : 'to_move'}=${total.moved} plain=${total.plain} unreadable=${total.unreadable}`,
    );
    if (total.unreadable > 0) {
      console.log('Some messages cannot be read with any configured key. Keep the old keys until this is understood.');
    } else if (apply || total.moved === 0) {
      console.log('All encrypted messages are on the current key once this run has applied.');
    }
  } finally {
    await app.close();
  }
  process.exit(exitCode);
}

async function processTenant(
  conn: DataSource,
  enc: { reencryptIfNeeded(c: string, iv: string): { content: string; iv: string } | null },
  apply: boolean,
): Promise<Counts> {
  const counts: Counts = { scanned: 0, current: 0, moved: 0, plain: 0, unreadable: 0 };
  const [{ exists }] = await conn.query(`SELECT to_regclass('public.messages') IS NOT NULL AS exists`);
  if (!exists) return counts;

  let lastId = '00000000-0000-0000-0000-000000000000';
  for (;;) {
    const rows: Array<{ id: string; content_encrypted: string; encryption_iv: string | null }> = await conn.query(
      `SELECT id, content_encrypted, encryption_iv FROM messages
        WHERE content_encrypted IS NOT NULL AND id > $1
        ORDER BY id LIMIT ${BATCH}`,
      [lastId],
    );
    if (rows.length === 0) break;
    lastId = rows[rows.length - 1].id;

    for (const row of rows) {
      counts.scanned++;
      if (row.content_encrypted.split(':').length !== 2) {
        counts.plain++;
        continue;
      }
      let next: { content: string; iv: string } | null;
      try {
        next = enc.reencryptIfNeeded(row.content_encrypted, row.encryption_iv ?? '');
      } catch {
        counts.unreadable++;
        continue;
      }
      if (!next) {
        counts.current++;
        continue;
      }
      counts.moved++;
      if (apply) {
        await conn.query(
          `UPDATE messages SET content_encrypted = $1, encryption_iv = $2
            WHERE id = $3 AND content_encrypted = $4`,
          [next.content, next.iv, row.id, row.content_encrypted],
        );
      }
    }
  }
  return counts;
}

bootstrap().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
