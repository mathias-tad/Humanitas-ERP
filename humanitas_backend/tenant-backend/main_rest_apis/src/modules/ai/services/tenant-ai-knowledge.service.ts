import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AiFileParserService } from './ai-file-parser.service';
import { CreateKnowledgeDocumentDto, UpdateKnowledgeDocumentDto } from '../dto/tenant-knowledge.dto';

export interface KnowledgeChunk {
  chunk_index: number;
  section_title: string | null;
  chunk_text: string;
  page_number: number | null;
  token_count: number;
}

export interface SearchResultItem {
  document_id: string;
  document_title: string;
  category: string;
  section_title: string | null;
  chunk_text: string;
  page_number: number | null;
  relevance_score: number;
}

@Injectable()
export class TenantAiKnowledgeService {
  private readonly logger = new Logger(TenantAiKnowledgeService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly fileParserService: AiFileParserService,
  ) {}

  private async getConnection(tenantSlug: string) {
    const rows = await (this.databaseService as any).masterDataSource.query(
      `SELECT id, database_name FROM tenants WHERE slug = $1`,
      [tenantSlug],
    );
    if (!rows || !rows.length) {
      throw new NotFoundException(`Tenant with slug "${tenantSlug}" not found`);
    }
    const ds = await this.databaseService.getTenantConnection(rows[0].database_name);
    return { ds, tenantId: rows[0].id };
  }

  /**
   * Intelligently chunks text by section/article headings or paragraphs.
   */
  chunkText(rawText: string): KnowledgeChunk[] {
    if (!rawText || !rawText.trim()) return [];

    const lines = rawText.split(/\r?\n/);
    const sections: { title: string | null; content: string[] }[] = [];
    let currentTitle: string | null = null;
    let currentLines: string[] = [];

    // Header detection regex
    const headerRegex = /^(?:(?:SECTION|ARTICLE|CHAPTER|PART|CLAUSE)\s+\d+|[0-9]+\.[0-9]+(?:\.[0-9]+)?|[A-Z\s]{4,50}:?$)/i;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (currentLines.length > 0) currentLines.push('');
        continue;
      }

      // Check if line looks like a section header
      const isHeader = (
        (trimmed.length <= 90 && headerRegex.test(trimmed)) ||
        (trimmed.endsWith(':') && trimmed.length <= 70 && !trimmed.includes('.'))
      );

      if (isHeader) {
        if (currentLines.length > 0) {
          sections.push({ title: currentTitle, content: currentLines });
          currentLines = [];
        }
        currentTitle = trimmed.replace(/[:]+$/, '');
      } else {
        currentLines.push(trimmed);
      }
    }

    if (currentLines.length > 0) {
      sections.push({ title: currentTitle, content: currentLines });
    }

    const chunks: KnowledgeChunk[] = [];
    let chunkIndex = 1;

    for (const sec of sections) {
      const fullText = sec.content.join('\n').trim();
      if (!fullText) continue;

      const words = fullText.split(/\s+/);
      const maxWordsPerChunk = 450;
      const overlapWords = 40;

      if (words.length <= maxWordsPerChunk) {
        chunks.push({
          chunk_index: chunkIndex++,
          section_title: sec.title,
          chunk_text: fullText,
          page_number: 1,
          token_count: Math.ceil(fullText.length / 4),
        });
      } else {
        // Split long sections into overlapping chunks
        let start = 0;
        let subIndex = 1;
        while (start < words.length) {
          const end = Math.min(start + maxWordsPerChunk, words.length);
          const chunkWords = words.slice(start, end);
          const chunkStr = chunkWords.join(' ');
          const subTitle = sec.title ? `${sec.title} (Part ${subIndex++})` : `Part ${subIndex++}`;

          chunks.push({
            chunk_index: chunkIndex++,
            section_title: subTitle,
            chunk_text: chunkStr,
            page_number: Math.floor(start / maxWordsPerChunk) + 1,
            token_count: Math.ceil(chunkStr.length / 4),
          });

          if (end >= words.length) break;
          start += (maxWordsPerChunk - overlapWords);
        }
      }
    }

    return chunks;
  }

  /**
   * Create a new policy or company knowledge document with automatic chunking.
   */
  async createDocument(
    tenantSlug: string,
    userId: string,
    dto: CreateKnowledgeDocumentDto,
    file?: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ) {
    const { ds } = await this.getConnection(tenantSlug);

    let rawText = dto.raw_text?.trim() || '';
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let fileMime: string | null = null;
    let contentType = dto.content_type || 'text';

    if (file) {
      contentType = 'file';
      fileName = file.originalname;
      fileSize = file.size;
      fileMime = file.mimetype;

      const parsed = await this.fileParserService.extractText(file.buffer, file.mimetype, file.originalname);
      rawText = parsed.text?.trim() || '';
      if (!rawText) {
        throw new BadRequestException('Could not extract readable text from the uploaded document.');
      }
    }

    if (!rawText) {
      throw new BadRequestException('Document content (raw_text or uploaded file) is required.');
    }

    const summary = dto.summary?.trim() || rawText.substring(0, 300).replace(/\s+/g, ' ') + '...';
    const chunks = this.chunkText(rawText);

    // Insert Document
    const docInsertSql = `
      INSERT INTO tenant_ai_knowledge_documents (
        company_id, branch_id, title, category, content_type,
        file_name, file_size, file_mime, raw_text, summary,
        metadata, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const meta = {
      ...(dto.metadata || {}),
      chunk_count: chunks.length,
      word_count: rawText.split(/\s+/).length,
      char_count: rawText.length,
    };

    const docResult = await ds.query(docInsertSql, [
      dto.company_id || null,
      dto.branch_id || null,
      dto.title,
      dto.category || 'company_policy',
      contentType,
      fileName,
      fileSize,
      fileMime,
      rawText,
      summary,
      JSON.stringify(meta),
      dto.is_active !== undefined ? dto.is_active : true,
      userId,
    ]);

    const createdDoc = docResult[0];

    // Insert Chunks
    for (const chunk of chunks) {
      await ds.query(
        `INSERT INTO tenant_ai_knowledge_chunks (
          document_id, chunk_index, section_title, chunk_text, page_number, token_count
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          createdDoc.id,
          chunk.chunk_index,
          chunk.section_title,
          chunk.chunk_text,
          chunk.page_number,
          chunk.token_count,
        ],
      );
    }

    return {
      ...createdDoc,
      chunk_count: chunks.length,
    };
  }

  /**
   * Retrieve list of knowledge documents for the tenant.
   */
  async getDocuments(
    tenantSlug: string,
    query?: string,
    category?: string,
    companyId?: string,
    branchId?: string,
  ) {
    const { ds } = await this.getConnection(tenantSlug);

    let sql = `
      SELECT d.id, d.company_id, d.branch_id, d.title, d.category, d.content_type,
             d.file_name, d.file_size, d.file_mime, d.summary, d.metadata,
             d.is_active, d.created_by, d.created_at, d.updated_at,
             COUNT(c.id)::int as chunk_count
      FROM tenant_ai_knowledge_documents d
      LEFT JOIN tenant_ai_knowledge_chunks c ON d.id = c.document_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (category) {
      sql += ` AND d.category = $${idx++}`;
      params.push(category);
    }
    if (companyId) {
      sql += ` AND (d.company_id IS NULL OR d.company_id = $${idx++})`;
      params.push(companyId);
    }
    if (branchId) {
      sql += ` AND (d.branch_id IS NULL OR d.branch_id = $${idx++})`;
      params.push(branchId);
    }
    if (query) {
      sql += ` AND (d.title ILIKE $${idx} OR d.summary ILIKE $${idx})`;
      params.push(`%${query}%`);
      idx++;
    }

    sql += ` GROUP BY d.id ORDER BY d.created_at DESC`;

    return ds.query(sql, params).catch(() => []);
  }

  /**
   * Get a single document with its complete chunks.
   */
  async getDocumentById(tenantSlug: string, id: string) {
    const { ds } = await this.getConnection(tenantSlug);
    const docs = await ds.query(
      `SELECT * FROM tenant_ai_knowledge_documents WHERE id = $1`,
      [id],
    );
    if (!docs || docs.length === 0) {
      throw new NotFoundException(`Knowledge document "${id}" not found`);
    }

    const chunks = await ds.query(
      `SELECT id, chunk_index, section_title, chunk_text, page_number, token_count, created_at
       FROM tenant_ai_knowledge_chunks
       WHERE document_id = $1
       ORDER BY chunk_index ASC`,
      [id],
    );

    return {
      ...docs[0],
      chunks,
    };
  }

  /**
   * Update document metadata or content (re-chunking if content changes).
   */
  async updateDocument(
    tenantSlug: string,
    id: string,
    dto: UpdateKnowledgeDocumentDto,
  ) {
    const { ds } = await this.getConnection(tenantSlug);
    const existing = await this.getDocumentById(tenantSlug, id);

    let rawText = dto.raw_text !== undefined ? dto.raw_text.trim() : existing.raw_text;
    const summary = dto.summary !== undefined ? dto.summary.trim() : existing.summary;
    const title = dto.title !== undefined ? dto.title : existing.title;
    const category = dto.category !== undefined ? dto.category : existing.category;
    const isActive = dto.is_active !== undefined ? dto.is_active : existing.is_active;

    await ds.query(
      `UPDATE tenant_ai_knowledge_documents
       SET title = $1, category = $2, summary = $3, raw_text = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [title, category, summary, rawText, isActive, id],
    );

    // If text was updated, re-generate chunks
    if (dto.raw_text && dto.raw_text !== existing.raw_text) {
      await ds.query(`DELETE FROM tenant_ai_knowledge_chunks WHERE document_id = $1`, [id]);
      const chunks = this.chunkText(rawText);
      for (const chunk of chunks) {
        await ds.query(
          `INSERT INTO tenant_ai_knowledge_chunks (
            document_id, chunk_index, section_title, chunk_text, page_number, token_count
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            chunk.chunk_index,
            chunk.section_title,
            chunk.chunk_text,
            chunk.page_number,
            chunk.token_count,
          ],
        );
      }
    }

    return this.getDocumentById(tenantSlug, id);
  }

  /**
   * Delete document and all cascaded chunks.
   */
  async deleteDocument(tenantSlug: string, id: string) {
    const { ds } = await this.getConnection(tenantSlug);
    const result = await ds.query(
      `DELETE FROM tenant_ai_knowledge_documents WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!result || result.length === 0) {
      throw new NotFoundException(`Knowledge document "${id}" not found`);
    }
    return { success: true, message: 'Document and its indexed chunks successfully deleted' };
  }

  /**
   * Search knowledge base for exact policy excerpts and citations.
   */
  async searchKnowledge(
    tenantSlug: string,
    query: string,
    category?: string,
    companyId?: string,
    branchId?: string,
    limit: number = 5,
  ): Promise<SearchResultItem[]> {
    if (!query || !query.trim()) return [];

    const { ds } = await this.getConnection(tenantSlug);
    const cleanQuery = query.trim();

    // Clean terms for matching
    const terms = cleanQuery
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 2 && !['what', 'when', 'where', 'how', 'does', 'the', 'and', 'for', 'our', 'are'].includes(t));

    let sql = `
      SELECT c.id as chunk_id, c.document_id, c.chunk_index, c.section_title,
             c.chunk_text, c.page_number, d.title as document_title, d.category
      FROM tenant_ai_knowledge_chunks c
      JOIN tenant_ai_knowledge_documents d ON c.document_id = d.id
      WHERE d.is_active = true
    `;
    const params: any[] = [];
    let idx = 1;

    if (category) {
      sql += ` AND d.category = $${idx++}`;
      params.push(category);
    }
    if (companyId) {
      sql += ` AND (d.company_id IS NULL OR d.company_id = $${idx++})`;
      params.push(companyId);
    }
    if (branchId) {
      sql += ` AND (d.branch_id IS NULL OR d.branch_id = $${idx++})`;
      params.push(branchId);
    }

    // Match either full query or any significant terms
    if (terms.length > 0) {
      const termConditions: string[] = [];
      termConditions.push(`c.chunk_text ILIKE $${idx}`);
      termConditions.push(`c.section_title ILIKE $${idx}`);
      termConditions.push(`d.title ILIKE $${idx}`);
      params.push(`%${cleanQuery}%`);
      idx++;

      for (const t of terms.slice(0, 4)) {
        termConditions.push(`c.chunk_text ILIKE $${idx}`);
        termConditions.push(`c.section_title ILIKE $${idx}`);
        params.push(`%${t}%`);
        idx++;
      }

      sql += ` AND (${termConditions.join(' OR ')})`;
    }

    sql += ` LIMIT 20`;

    const rawRows = await ds.query(sql, params).catch(() => []);

    // Rank rows by relevance
    const ranked: SearchResultItem[] = rawRows.map((r: any) => {
      let score = 0;
      const textLower = (r.chunk_text || '').toLowerCase();
      const secLower = (r.section_title || '').toLowerCase();
      const docLower = (r.document_title || '').toLowerCase();
      const qLower = cleanQuery.toLowerCase();

      // Full phrase matches get top score
      if (textLower.includes(qLower)) score += 15;
      if (secLower.includes(qLower)) score += 20;
      if (docLower.includes(qLower)) score += 10;

      // Individual terms
      for (const term of terms) {
        if (secLower.includes(term)) score += 5;
        if (textLower.includes(term)) score += 3;
        if (docLower.includes(term)) score += 2;
      }

      return {
        document_id: r.document_id,
        document_title: r.document_title,
        category: r.category,
        section_title: r.section_title,
        chunk_text: r.chunk_text,
        page_number: r.page_number,
        relevance_score: score,
      };
    });

    ranked.sort((a, b) => b.relevance_score - a.relevance_score);

    return ranked.slice(0, limit);
  }
}
