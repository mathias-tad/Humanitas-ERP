import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlatformKnowledgeService } from './platform-knowledge.service';
import { CreatePlatformKnowledgeDto, UpdatePlatformKnowledgeDto } from './dto/platform-knowledge.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Platform Knowledge & SaaS Provider Info')
@ApiBearerAuth()
@Controller('admin/platform-knowledge')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PlatformKnowledgeController {
  constructor(private readonly knowledgeService: PlatformKnowledgeService) {}

  @Get()
  @ApiOperation({ summary: 'List platform knowledge entries' })
  findAll(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.knowledgeService.findAll(category, search);
  }

  @Post('seed-defaults')
  @ApiOperation({ summary: 'Seed default SaaS info and system knowledge' })
  seedDefaults() {
    return this.knowledgeService.seedDefaults();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific platform knowledge entry' })
  findOne(@Param('id') id: string) {
    return this.knowledgeService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new platform knowledge entry' })
  create(@Body() dto: CreatePlatformKnowledgeDto) {
    return this.knowledgeService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a platform knowledge entry' })
  update(@Param('id') id: string, @Body() dto: UpdatePlatformKnowledgeDto) {
    return this.knowledgeService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a platform knowledge entry' })
  remove(@Param('id') id: string) {
    return this.knowledgeService.remove(id);
  }
}
