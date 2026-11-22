import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { assertAllowedExtension, getUploadsDir, randomUploadName } from '../messaging/upload-utils';
import type { CatalogContext } from './products.service';
import { isVisible, resolveCompanyScope, type Queryable } from './products.scope';
import type { ReorderMediaDto, UpdateMediaDto } from './dto/product-extras.dto';
import { sniffFile } from './product-structure';

export const MAX_MEDIA_PER_PRODUCT = 30;
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

/** A disk error as a message the person can act on (the uploads folder must be writable by the app). */
export function storageErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
    return `The server cannot save files: its uploads folder is not writable (${code}). Ask your administrator to give the app write access to the uploads folder.`;
  }
  if (code === 'ENOSPC') return 'The server disk is full, so the file could not be saved.';
  return `The server could not save the file${code ? ` (${code})` : ''}.`;
}

export interface UploadedFile {
  data: Buffer;
  filename: string;
  mimetype?: string;
}

const MEDIA_SQL = `SELECT id, product_id, kind, file_path, file_name, mime_type, file_size, title, is_primary, sort_order, created_at
                     FROM product_media`;

/** Product gallery (pictures) and attachments (spec sheets, certificates, manuals). */
@Injectable()
export class ProductMediaService {
  private readonly logger = new Logger(ProductMediaService.name);

  /** Where files go; tests point it at a temporary folder. */
  uploadsRoot = () => getUploadsDir();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async list(ctx: CatalogContext, productId: string) {
    const { conn } = await this.openProduct(ctx, productId);
    return conn.query(`${MEDIA_SQL} WHERE product_id = $1 AND is_active ORDER BY kind DESC, is_primary DESC, sort_order, created_at`, [productId]);
  }

  /** kind=image: JPEG, PNG, WebP or GIF; kind=attachment: PDF, Word, Excel, PowerPoint, text, CSV or a picture. */
  async upload(ctx: CatalogContext, productId: string, file: UploadedFile, opts: { kind?: string; title?: string }) {
    const { conn, product } = await this.openProduct(ctx, productId);
    const kind = opts.kind === 'attachment' ? 'attachment' : 'image';
    if (!file?.data?.length) throw new BadRequestException('Choose a file');
    if (file.data.length > MAX_MEDIA_BYTES) throw new BadRequestException('The file is larger than 5 MB');
    const ext = assertAllowedExtension(file.filename, kind === 'image');
    const sniffed = sniffFile(file.data, ext);
    if (!sniffed || (kind === 'image' && sniffed.kind !== 'image')) {
      throw new BadRequestException(kind === 'image' ? 'This is not a JPEG, PNG, WebP or GIF picture' : 'This file type cannot be attached');
    }
    const [{ n }] = await conn.query(`SELECT count(*)::int AS n FROM product_media WHERE product_id = $1 AND is_active`, [productId]);
    if (n >= MAX_MEDIA_PER_PRODUCT) throw new BadRequestException(`A product can have up to ${MAX_MEDIA_PER_PRODUCT} pictures and attachments`);

    const tenantDir = ctx.tenantId.replace(/[^a-zA-Z0-9-]/g, '');
    const stored = randomUploadName(kind === 'image' ? 'img' : 'doc', ext);
    try {
      const dir = path.join(this.uploadsRoot(), 'products', tenantDir);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(path.join(dir, stored), file.data);
    } catch (err) {
      this.logger.error(`Saving a product file failed: ${(err as Error)?.message}`, (err as Error)?.stack);
      throw new InternalServerErrorException(storageErrorMessage(err));
    }
    const filePath = `/uploads/products/${tenantDir}/${stored}`;
    const name = path.basename(file.filename).slice(0, 255) || stored;

    const id = await conn.transaction(async (m: Queryable) => {
      const [{ has_primary }] = await m.query(
        `SELECT EXISTS (SELECT 1 FROM product_media WHERE product_id = $1 AND is_primary AND is_active) AS has_primary`, [productId],
      );
      const primary = kind === 'image' && !has_primary;
      const [row] = await m.query(
        `INSERT INTO product_media (product_id, kind, file_path, file_name, mime_type, file_size, title, is_primary, sort_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                 COALESCE((SELECT max(sort_order) + 1 FROM product_media WHERE product_id = $1 AND is_active), 0), $9)
         RETURNING id`,
        [productId, kind, filePath, name, sniffed.mime, file.data.length, opts.title?.trim().slice(0, 150) || null, primary, ctx.user?.sub ?? null],
      );
      if (primary) await this.setProductImage(m, productId, filePath, ctx.user?.sub);
      return row.id as string;
    });
    await this.record(ctx, productId, `${kind === 'image' ? 'Picture' : 'Attachment'} "${name}" added to "${product.name}"`);
    const [media] = await conn.query(`${MEDIA_SQL} WHERE id = $1`, [id]);
    return media;
  }

  async update(ctx: CatalogContext, productId: string, mediaId: string, dto: UpdateMediaDto) {
    const { conn, product } = await this.openProduct(ctx, productId);
    const media = await this.find(conn, productId, mediaId);
    if (dto.is_primary && media.kind !== 'image') throw new BadRequestException('Only a picture can be the main picture');
    await conn.transaction(async (m: Queryable) => {
      if (dto.title !== undefined) await m.query(`UPDATE product_media SET title = $1, updated_at = now() WHERE id = $2`, [dto.title?.trim() || null, mediaId]);
      if (dto.is_primary && !media.is_primary) {
        await m.query(`UPDATE product_media SET is_primary = false, updated_at = now() WHERE product_id = $1 AND is_primary`, [productId]);
        await m.query(`UPDATE product_media SET is_primary = true, updated_at = now() WHERE id = $1`, [mediaId]);
        await this.setProductImage(m, productId, media.file_path, ctx.user?.sub);
      }
    });
    if (dto.is_primary && !media.is_primary) await this.record(ctx, productId, `Main picture of "${product.name}" changed`);
    const [row] = await conn.query(`${MEDIA_SQL} WHERE id = $1`, [mediaId]);
    return row;
  }

  /** Removes it from the product (rule 24: archived, the file is kept). The next picture becomes the main one. */
  async archive(ctx: CatalogContext, productId: string, mediaId: string) {
    const { conn, product } = await this.openProduct(ctx, productId);
    const media = await this.find(conn, productId, mediaId);
    await conn.transaction(async (m: Queryable) => {
      await m.query(`UPDATE product_media SET is_active = false, is_primary = false, updated_at = now() WHERE id = $1`, [mediaId]);
      if (media.is_primary) {
        const [next] = await m.query(
          `SELECT id, file_path FROM product_media WHERE product_id = $1 AND is_active AND kind = 'image' ORDER BY sort_order, created_at LIMIT 1`,
          [productId],
        );
        if (next) await m.query(`UPDATE product_media SET is_primary = true, updated_at = now() WHERE id = $1`, [next.id]);
        await this.setProductImage(m, productId, next?.file_path ?? null, ctx.user?.sub, media.file_path);
      }
    });
    await this.record(ctx, productId, `${media.kind === 'image' ? 'Picture' : 'Attachment'} "${media.file_name}" removed from "${product.name}"`);
    return { ok: true };
  }

  async reorder(ctx: CatalogContext, productId: string, dto: ReorderMediaDto) {
    const { conn } = await this.openProduct(ctx, productId);
    const rows: { id: string }[] = await conn.query(`SELECT id FROM product_media WHERE product_id = $1 AND is_active`, [productId]);
    const ids = new Set(rows.map((r) => r.id));
    if (dto.media_ids.length !== ids.size || dto.media_ids.some((id) => !ids.has(id)) || new Set(dto.media_ids).size !== ids.size) {
      throw new BadRequestException('Send every picture and attachment of the product once');
    }
    await conn.transaction(async (m: Queryable) => {
      for (const [i, id] of dto.media_ids.entries()) await m.query(`UPDATE product_media SET sort_order = $1 WHERE id = $2`, [i, id]);
    });
    return this.list(ctx, productId);
  }

  private async openProduct(ctx: CatalogContext, productId: string) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const scope = await resolveCompanyScope(conn, ctx.user, ctx.companyHeader, ctx.branchHeader);
    const [product] = await conn.query(`SELECT id, name, company_id, branch_id, image_url FROM products WHERE id = $1`, [productId]);
    if (!product || !isVisible(scope, product.company_id, product.branch_id)) throw new NotFoundException('Product not found');
    return { conn, product };
  }

  private async find(conn: Queryable, productId: string, mediaId: string) {
    const [media] = await conn.query(`SELECT * FROM product_media WHERE id = $1 AND product_id = $2 AND is_active`, [mediaId, productId]);
    if (!media) throw new NotFoundException('Picture or attachment not found');
    return media;
  }

  /** The main picture is the product's image (lists, POS, labels, the app). Only replaces an image the gallery set. */
  private async setProductImage(m: Queryable, productId: string, filePath: string | null, actor?: string, replacing?: string) {
    if (replacing) {
      await m.query(`UPDATE products SET image_url = $1, updated_by = $2, updated_at = now() WHERE id = $3 AND image_url = $4`, [filePath, actor ?? null, productId, replacing]);
    } else {
      await m.query(`UPDATE products SET image_url = $1, updated_by = $2, updated_at = now() WHERE id = $3`, [filePath, actor ?? null, productId]);
    }
  }

  private record(ctx: CatalogContext, productId: string, summary: string) {
    return this.timeline.record(ctx.tenantId, {
      entityType: 'product', entityId: productId, eventType: 'updated', moduleKey: 'products', summary, actorId: ctx.user?.sub, client: ctx.client,
    });
  }
}
