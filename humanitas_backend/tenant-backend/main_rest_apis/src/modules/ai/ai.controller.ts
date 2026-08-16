import { Controller, Post, Body, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, PERMISSIONS_KEY } from '../auth/guards/permissions.guard';
import { SetMetadata } from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  conversationId?: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @Permissions('use_ai')
  async chat(@Req() req, @Body() body: ChatRequestDto) {
    const user = req.user;
    return this.aiService.processRequest(
      user.tenantId, user.tenantSlug, user.sub, user.role, body.message,
      user.full_name || 'User', body.conversationId
    );
  }

  @Post('chat-with-file')
  @Permissions('use_ai')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async chatWithFile(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ChatRequestDto,
  ) {
    const user = req.user;
    if (!file) {
      return this.aiService.processRequest(
        user.tenantId, user.tenantSlug, user.sub, user.role, body.message,
        user.full_name || 'User', body.conversationId
      );
    }
    return this.aiService.processRequestWithFile(
      user.tenantId, user.tenantSlug, user.sub, user.role, body.message || '',
      user.full_name || 'User',
      file.buffer, file.mimetype, file.originalname,
      body.conversationId
    );
  }
}
