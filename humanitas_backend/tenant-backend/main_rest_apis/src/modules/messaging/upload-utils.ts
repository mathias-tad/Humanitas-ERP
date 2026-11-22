import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Extensions accepted for chat uploads. Anything a browser could execute
 * (.html, .svg, .js, .xml, …) is deliberately absent.
 */
const ALLOWED_EXTENSIONS = new Set([
  // images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic',
  // audio (voice notes)
  '.m4a', '.mp3', '.ogg', '.oga', '.opus', '.wav', '.aac', '.webm',
  // video
  '.mp4', '.mov', '.m4v',
  // documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.zip',
]);

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic']);

export function getUploadsDir(): string {
  const dir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Validates the extension and returns it lower-cased (throws on anything not allowed). */
export function assertAllowedExtension(originalName: string | undefined, imagesOnly = false): string {
  const ext = path.extname(originalName || '').toLowerCase();
  const allowed = imagesOnly ? IMAGE_EXTENSIONS : ALLOWED_EXTENSIONS;
  if (!ext || !allowed.has(ext)) {
    throw new BadRequestException(
      `File type "${ext || 'unknown'}" is not allowed${imagesOnly ? ' (images only)' : ''}.`,
    );
  }
  return ext;
}

/**
 * Builds an unguessable file name: `<prefix>_<timestamp>_<128-bit random>.<ext>`.
 * The random part makes `/uploads/...` URLs capability links that cannot be enumerated.
 */
export function randomUploadName(prefix: string, ext: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${safePrefix}_${Date.now()}_${crypto.randomBytes(16).toString('hex')}${ext}`;
}

/**
 * Headers applied to every file served from /uploads/.
 * - nosniff: browsers must honour our Content-Type
 * - CSP sandbox: even if something slipped through, it cannot run script on the API origin
 * - non-media files are forced to download instead of rendering inline
 */
export function setUploadResponseHeaders(
  res: { setHeader?: (k: string, v: string) => unknown; header?: (k: string, v: string) => unknown },
  filePath: string,
) {
  // @fastify/static 10 passes the Fastify reply (reply.header); older versions the raw response (setHeader).
  const set = (k: string, v: string) => (typeof res.header === 'function' ? res.header(k, v) : res.setHeader?.(k, v));
  set('X-Content-Type-Options', 'nosniff');
  set('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
  set('Cross-Origin-Resource-Policy', 'same-site');
  const ext = path.extname(filePath).toLowerCase();
  const inline = /^\.(jpe?g|png|gif|webp|heic|m4a|mp3|ogg|oga|opus|wav|aac|webm|mp4|mov|m4v|pdf)$/.test(ext);
  if (!inline) {
    set('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
  }
}
