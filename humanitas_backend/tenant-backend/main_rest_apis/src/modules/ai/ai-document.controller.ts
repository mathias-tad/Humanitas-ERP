import { Controller, Post, Body, UseGuards, Req, Res, BadRequestException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiDocumentService } from './services/ai-document.service';
import { RoleContextBuilderService } from './services/role-context-builder.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, PERMISSIONS_KEY } from '../auth/guards/permissions.guard';
import { SetMetadata } from '@nestjs/common';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import type { FastifyReply } from 'fastify';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export class GenerateDocumentDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsEnum(['pdf', 'docx', 'excel'])
  format: 'pdf' | 'docx' | 'excel';

  @IsString()
  @IsOptional()
  referenceText?: string;
}

@Controller('ai/document')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiDocumentController {
  constructor(
    private readonly aiDocumentService: AiDocumentService,
    private readonly roleContextBuilder: RoleContextBuilderService,
  ) {}

  @Post('generate')
  @Permissions('use_ai')
  async generateDocument(
    @Req() req,
    @Body() body: GenerateDocumentDto,
    @Res() res: FastifyReply,
  ) {
    const user = req.user;
    const roleContext = await this.roleContextBuilder.buildContext(user.tenantSlug, user.sub, user.role);

    try {
      if (body.format === 'pdf') {
        const { buffer: pdfBuffer, filename } = await this.aiDocumentService.generatePdf(user.tenantSlug, roleContext, body.prompt, body.referenceText);
        res.header('Content-Type', 'application/pdf');
        res.header('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        res.header('Content-Length', pdfBuffer.length.toString());
        res.send(pdfBuffer);
      } else if (body.format === 'docx') {
        const { buffer: docxBuffer, filename } = await this.aiDocumentService.generateDocx(user.tenantSlug, roleContext, body.prompt, body.referenceText);
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.header('Content-Disposition', `attachment; filename="${filename}.docx"`);
        res.header('Content-Length', docxBuffer.length.toString());
        res.send(docxBuffer);
      } else if (body.format === 'excel') {
        const { buffer: excelBuffer, filename } = await this.aiDocumentService.generateExcel(user.tenantSlug, roleContext, body.prompt);
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.header('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        res.header('Content-Length', excelBuffer.length.toString());
        res.send(excelBuffer);
      }
    } catch (error) {
      console.error('ERROR GENERATING DOCUMENT:', error);
      throw new BadRequestException('Failed to generate document: ' + error.message);
    }
  }

  @Post('generate-with-reference')
  @Permissions('use_ai')
  @UseInterceptors(FileInterceptor('file'))
  async generateDocumentWithReference(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { prompt: string; format: 'pdf' | 'docx' | 'excel' },
    @Res() res: FastifyReply,
  ) {
    const user = req.user;
    const roleContext = await this.roleContextBuilder.buildContext(user.tenantSlug, user.sub, user.role);

    let referenceText = '';
    if (file) {
      try {
        const mammoth = await import('mammoth');
        if (file.mimetype.includes('wordprocessingml') || file.originalname.endsWith('.docx')) {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          referenceText = result.value?.substring(0, 8000) || '';
        } else if (file.mimetype === 'application/pdf') {
          const pdfParse = require('pdf-parse');
          const parsed = await pdfParse(file.buffer);
          referenceText = parsed.text?.substring(0, 8000) || '';
        }
      } catch (e) {
        referenceText = '';
      }
    }

    return this.generateDocument(req, { prompt: body.prompt, format: body.format || 'pdf', referenceText }, res);
  }
}
