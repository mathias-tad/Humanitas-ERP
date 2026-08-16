import { Injectable } from '@nestjs/common';
import * as path from 'path';

@Injectable()
export class AiFileParserService {

  async extractText(buffer: Buffer, mimetype: string, originalname: string): Promise<{ text: string; isImage: boolean; base64?: string }> {
    const ext = path.extname(originalname).toLowerCase();

    // IMAGE
    if (mimetype.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      return {
        text: '',
        isImage: true,
        base64: buffer.toString('base64'),
      };
    }

    // PDF
    if (mimetype === 'application/pdf' || ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const parsed = await pdfParse(buffer);
      return { text: parsed.text?.trim() || '', isImage: false };
    }

    // DOCX
    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword' ||
      ['.docx', '.doc'].includes(ext)
    ) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value?.trim() || '', isImage: false };
    }

    // Plain text fallback
    return { text: buffer.toString('utf-8').trim(), isImage: false };
  }
}
