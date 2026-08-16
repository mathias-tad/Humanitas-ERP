import { Injectable, BadRequestException } from '@nestjs/common';
const PDFDocument = require('pdfkit');
import * as ExcelJS from 'exceljs';
import { DatabaseService } from '../../database/database.service';
import { AiSettingsFetchService } from './ai-settings-fetch.service';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage } from '@langchain/core/messages';

@Injectable()
export class AiDocumentService {
  constructor(
    private databaseService: DatabaseService,
    private aiSettingsFetch: AiSettingsFetchService,
  ) {}

  /**
   * Fetch real data from the tenant database based on the user prompt.
   * Provides the FULL schema (tables + columns) to the AI before it writes SQL.
   */
  private async fetchDatabaseData(tenantSlug: string, prompt: string): Promise<string> {
    try {
      const rows = await (this.databaseService as any).masterDataSource.query(
        `SELECT database_name FROM tenants WHERE slug = $1`,
        [tenantSlug],
      );
      if (!rows || !rows.length) return 'No tenant database found.';

      const dataSource = await this.databaseService.getTenantConnection(rows[0].database_name);

      // Fetch full schema: all tables with their columns
      const schemaRows = await dataSource.query(`
        SELECT c.table_name, c.column_name, c.data_type
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND t.table_schema = 'public'
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position
      `);

      // Build a human-readable schema string: "users(id, first_name, last_name, email, ...)"
      const schemaMap: Record<string, string[]> = {};
      for (const row of schemaRows) {
        if (!schemaMap[row.table_name]) schemaMap[row.table_name] = [];
        schemaMap[row.table_name].push(`${row.column_name}(${row.data_type})`);
      }
      const schemaStr = Object.entries(schemaMap)
        .map(([table, cols]) => `${table}(${cols.join(', ')})`)
        .join('\n');

      // Use AI to write correct SQL using the real schema
      const settings = await this.aiSettingsFetch.getSettings(tenantSlug);
      const modelName = settings.model || (settings.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-pro-001');
      let llm: any;

      if (settings.provider === 'vertex') {
        llm = new ChatGoogleGenerativeAI({ model: modelName, temperature: 0, apiKey: settings.api_key });
        if (settings.gcp_project_id && settings.api_key) {
          const { GoogleGenerativeAI } = require('@google/generative-ai');
          const gcpLocation = settings.gcp_location || 'us-central1';
          (llm as any).client = new GoogleGenerativeAI(settings.api_key).getGenerativeModel(
            { model: modelName },
            { baseUrl: `https://${gcpLocation}-aiplatform.googleapis.com`, apiVersion: `v1/projects/${settings.gcp_project_id}/locations/${gcpLocation}/publishers/google` }
          );
        }
      } else if (settings.provider === 'openai') {
        llm = new ChatOpenAI({ model: modelName, temperature: 0, apiKey: settings.api_key });
      } else if (settings.provider === 'anthropic') {
        llm = new ChatAnthropic({ model: modelName, temperature: 0, apiKey: settings.api_key });
      } else {
        llm = new ChatGoogleGenerativeAI({ model: modelName, temperature: 0, apiKey: settings.api_key });
      }

      const queryPlanResult = await llm.invoke([
        new HumanMessage({
          content: `You are a PostgreSQL expert. The user wants a document about: "${prompt}"

Here is the EXACT database schema with real column names — use ONLY these column names, never guess:
${schemaStr}

Write 1-3 SQL SELECT queries (only SELECT) to fetch the relevant data needed for this document.
CRITICAL: Only use column names that exist in the schema above. Do NOT add any column that is not listed.
Return ONLY the SQL queries separated by "---QUERY---", nothing else. No explanations, no markdown.
Example output:
SELECT id, first_name, last_name, email FROM users
---QUERY---
SELECT id, name FROM departments`
        }),
      ]);

      const queryPlan = typeof queryPlanResult.content === 'string' ? queryPlanResult.content : '';
      // Strip markdown code blocks if AI wraps them
      const cleanPlan = queryPlan.replace(/```sql\n?/gi, '').replace(/```\n?/gi, '').trim();
      const queries = cleanPlan.split('---QUERY---').map(q => q.trim()).filter(q => q.toUpperCase().startsWith('SELECT'));

      const results: string[] = [];
      for (const query of queries.slice(0, 3)) {
        try {
          const data = await dataSource.query(query);
          const jsonStr = JSON.stringify(data);
          results.push(`Query: ${query}\nResults: ${jsonStr.length > 8000 ? jsonStr.substring(0, 8000) + '...(truncated)' : jsonStr}`);
        } catch (e) {
          // On failure, try a simplified fallback using just the main table
          console.warn(`AI-doc query failed: ${query}`, e.message);
          results.push(`Query failed (bad column name or table): ${query}\nError: ${e.message}`);
        }
      }

      return results.join('\n\n---\n\n') || 'No data found.';
    } catch (error) {
      console.error('Error fetching database data for document:', error);
      return `Could not fetch database data: ${error.message}`;
    }
  }


  /**
   * Generate a meaningful filename from the user prompt.
   */
  private generateFilename(prompt: string): string {
    // Extract key words, remove special chars, limit length
    const cleaned = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join('_');
    return cleaned || 'document';
  }

  private async generateContent(tenantSlug: string, roleContext: string, prompt: string, referenceText?: string): Promise<string> {
    // Step 1: Fetch REAL data from the database
    const realData = await this.fetchDatabaseData(tenantSlug, prompt);

    const settings = await this.aiSettingsFetch.getSettings(tenantSlug);
    let llm: any;
    const modelName = settings.model || (settings.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-pro-001');
    const temperature = 0.3;

    if (settings.provider === 'ollama') {
      const { ChatOllama } = await import('@langchain/ollama');
      llm = new ChatOllama({ model: modelName || 'llama3', temperature, baseUrl: settings.endpoint_url || 'http://localhost:11434' });
    } else if (settings.provider === 'vertex') {
      llm = new ChatGoogleGenerativeAI({ model: modelName, temperature, apiKey: settings.api_key });
      if (settings.gcp_project_id && settings.api_key) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const gcpLocation = settings.gcp_location || 'us-central1';
        (llm as any).client = new GoogleGenerativeAI(settings.api_key).getGenerativeModel(
          { model: modelName },
          { baseUrl: `https://${gcpLocation}-aiplatform.googleapis.com`, apiVersion: `v1/projects/${settings.gcp_project_id}/locations/${gcpLocation}/publishers/google` }
        );
      }
    } else if (settings.provider === 'openai') {
      llm = new ChatOpenAI({ model: modelName, temperature, apiKey: settings.api_key, configuration: settings.endpoint_url ? { baseURL: settings.endpoint_url } : undefined });
    } else if (settings.provider === 'anthropic') {
      llm = new ChatAnthropic({ model: modelName, temperature, apiKey: settings.api_key });
    } else {
      llm = new ChatGoogleGenerativeAI({ model: modelName, temperature, apiKey: settings.api_key });
    }

    const refSection = referenceText
      ? `\n\nThe user also provided a reference document to use as additional context:\n---\n${referenceText.substring(0, 4000)}\n---\n`
      : '';

    const systemPrompt = `You are a professional business document writer for the Humanitas ERP platform.
User context: ${roleContext}
${refSection}

CRITICAL RULES:
1. You MUST use ONLY the data provided below from the database. Do NOT invent, guess, or add any data that is not in the database results.
2. If the data is empty or insufficient, state clearly that no data was found.
3. Format the document professionally in clean Markdown with title, sections, and tables.
4. Include a generation timestamp at the top.
5. Do NOT add any preamble — output the document directly.

=== ACTUAL DATABASE DATA ===
${realData}
=== END OF DATABASE DATA ===

Generate the document based strictly on the above data.`;

    const result = await llm.invoke([
      new HumanMessage({ content: systemPrompt + '\n\nDocument request: ' + prompt }),
    ]);
    return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
  }


  async generatePdf(tenantSlug: string, userRoleContext: string, prompt: string, referenceText?: string): Promise<{ buffer: Buffer; filename: string }> {
    const markdownContent = await this.generateContent(tenantSlug, userRoleContext, prompt, referenceText);
    const filename = this.generateFilename(prompt);

    return new Promise((resolve, reject) => {
      try {
        const doc = new (PDFDocument as any)({ margin: 60, size: 'A4', bufferPages: true });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers) as any));
        doc.on('error', reject);

        // Parse and render markdown as styled PDF
        const lines = markdownContent.split('\n');
        let inTable = false;
        let tableRows: string[][] = [];

        const flushTable = () => {
          if (tableRows.length > 0) {
            const colCount = tableRows[0].length;
            const colWidth = (doc.page.width - 120) / colCount;
            tableRows.forEach((row, ri) => {
              if (ri === 1 && row.every(c => /^[-:]+$/.test(c.trim()))) return; // separator
              const y = doc.y;
              row.forEach((cell, ci) => {
                const isHeader = ri === 0;
                doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
                   .fontSize(9)
                   .text(cell.trim(), 60 + ci * colWidth, y, { width: colWidth - 4, continued: false });
              });
              doc.moveDown(0.3);
              if (ri === 0) {
                doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).stroke();
                doc.moveDown(0.2);
              }
            });
            tableRows = [];
            inTable = false;
            doc.moveDown(0.5);
          }
        };

        lines.forEach(line => {
          // Table row detection
          if (line.trim().startsWith('|')) {
            inTable = true;
            tableRows.push(line.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim()));
            return;
          }
          if (inTable) flushTable();

          if (line.startsWith('# ')) {
            doc.font('Helvetica-Bold').fontSize(22).fillColor('#1a1a2e').text(line.slice(2), { align: 'center' });
            doc.moveDown(0.4);
            doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).strokeColor('#3B82F6').lineWidth(2).stroke();
            doc.lineWidth(1).strokeColor('black');
            doc.moveDown(0.8);
          } else if (line.startsWith('## ')) {
            doc.moveDown(0.5);
            doc.font('Helvetica-Bold').fontSize(15).fillColor('#1e3a5f').text(line.slice(3));
            doc.moveDown(0.3);
          } else if (line.startsWith('### ')) {
            doc.moveDown(0.3);
            doc.font('Helvetica-Bold').fontSize(12).fillColor('#2c5282').text(line.slice(4));
            doc.moveDown(0.2);
          } else if (/^\d+\.\s/.test(line)) {
            doc.font('Helvetica').fontSize(10).fillColor('#222').text(line, { indent: 20 });
            doc.moveDown(0.2);
          } else if (line.startsWith('- ') || line.startsWith('* ')) {
            doc.font('Helvetica').fontSize(10).fillColor('#222').text('• ' + line.slice(2), { indent: 20 });
            doc.moveDown(0.2);
          } else if (line.startsWith('**') && line.endsWith('**')) {
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#222').text(line.replace(/\*\*/g, ''));
            doc.moveDown(0.2);
          } else if (line.trim() === '' || line.trim() === '---') {
            doc.moveDown(0.4);
          } else {
            // Strip inline markdown bold/italic
            const clean = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1');
            doc.font('Helvetica').fontSize(10).fillColor('#333').text(clean);
            doc.moveDown(0.2);
          }
        });
        if (inTable) flushTable();

        // Footer
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
          doc.switchToPage(i);
          doc.font('Helvetica').fontSize(8).fillColor('#999')
             .text(`Generated by Humanitas AI  |  Page ${i + 1} of ${pageCount}`, 60, doc.page.height - 40, { align: 'center', width: doc.page.width - 120 });
        }

        doc.end();
      } catch (error) {
        reject(new BadRequestException('Failed to generate PDF document: ' + error.message));
      }
    }).then((buffer: any) => ({ buffer, filename }));
  }

  async generateDocx(tenantSlug: string, userRoleContext: string, prompt: string, referenceText?: string): Promise<{ buffer: Buffer; filename: string }> {
    const markdownContent = await this.generateContent(tenantSlug, userRoleContext, prompt, referenceText);
    const filename = this.generateFilename(prompt);

    const docx = await import('docx');
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } = docx;

    const children: any[] = [];
    const lines = markdownContent.split('\n');
    let tableRows: string[][] = [];
    let inTable = false;

    const flushDocxTable = () => {
      if (tableRows.length < 2) { tableRows = []; inTable = false; return; }
      const rows = tableRows
        .filter((_, i) => !(i === 1 && tableRows[i].every(c => /^[-:]+$/.test(c.trim()))))
        .map((row, ri) =>
          new TableRow({
            children: row.map(cell =>
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: cell.trim(), bold: ri === 0, size: 20 })],
                })],
                width: { size: Math.floor(9000 / row.length), type: WidthType.DXA },
              })
            ),
          })
        );
      children.push(new Table({ rows, width: { size: 9000, type: WidthType.DXA } }));
      children.push(new Paragraph(''));
      tableRows = []; inTable = false;
    };

    lines.forEach(line => {
      if (line.trim().startsWith('|')) {
        inTable = true;
        tableRows.push(line.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim()));
        return;
      }
      if (inTable) flushDocxTable();

      if (line.startsWith('# ')) {
        children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
      } else if (line.startsWith('## ')) {
        children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
      } else if (line.startsWith('### ')) {
        children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
      } else if (/^\d+\.\s/.test(line)) {
        children.push(new Paragraph({ text: line, numbering: undefined, indent: { left: 360 } }));
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        children.push(new Paragraph({ text: '• ' + line.slice(2), indent: { left: 360 } }));
      } else if (line.trim() === '' || line.trim() === '---') {
        children.push(new Paragraph(''));
      } else {
        // Handle bold inline
        const parts = line.split(/(\*\*.*?\*\*)/g);
        const runs = parts.map(p => p.startsWith('**') ? new TextRun({ text: p.replace(/\*\*/g, ''), bold: true }) : new TextRun(p.replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1')));
        children.push(new Paragraph({ children: runs }));
      }
    });
    if (inTable) flushDocxTable();

    const doc = new Document({
      sections: [{
        properties: {},
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    return { buffer, filename };
  }

  async generateExcel(tenantSlug: string, userRoleContext: string, prompt: string): Promise<{ buffer: Buffer; filename: string }> {
    try {
      const filename = this.generateFilename(prompt);
      // Fetch real data
      const realData = await this.fetchDatabaseData(tenantSlug, prompt);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Humanitas AI';
      workbook.created = new Date();

      // Parse the data into rows per query result
      const sections = realData.split('\n\n---\n\n');
      for (const section of sections) {
        const resultsMatch = section.match(/Results: (\[.*)/s);
        if (!resultsMatch) continue;
        try {
          const rows: any[] = JSON.parse(resultsMatch[1].replace('...(truncated)', ''));
          if (!rows.length) continue;
          const sheetName = filename.split('_').slice(0, 2).join(' ').substring(0, 30) || 'Data';
          const worksheet = workbook.addWorksheet(sheetName);
          // Set columns from first row keys
          const keys = Object.keys(rows[0]);
          worksheet.columns = keys.map(k => ({ header: k.replace(/_/g, ' ').toUpperCase(), key: k, width: 22 }));
          // Style header row
          worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
          worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
          // Add data rows
          rows.forEach(row => worksheet.addRow(row));
          break; // One sheet per generate call is enough
        } catch { continue; }
      }

      if (workbook.worksheets.length === 0) {
        const ws = workbook.addWorksheet('Result');
        ws.addRow(['No structured data found for this query.']);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return { buffer: buffer as any as Buffer, filename };
    } catch (error) {
      throw new BadRequestException('Failed to generate Excel document: ' + error.message);
    }
  }
}
