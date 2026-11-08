import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupportTicketsService } from './support-tickets.service';
import {
  CreateSupportTicketDto,
  UpdateSupportTicketDto,
  SupportTicketFilterDto,
} from './dto/support-ticket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Support Tickets & Help Center (Admin)')
@ApiBearerAuth()
@Controller('admin/support-tickets')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SupportTicketsController {
  constructor(private readonly ticketsService: SupportTicketsService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get support ticket metrics & KPIs' })
  getMetrics() {
    return this.ticketsService.getMetrics();
  }

  @Get()
  @ApiOperation({ summary: 'List all support tickets with filters' })
  findAll(@Query() query: SupportTicketFilterDto) {
    return this.ticketsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single ticket detail' })
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create ticket from admin' })
  create(@Body() dto: CreateSupportTicketDto) {
    return this.ticketsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ticket status, resolution, or priority' })
  update(@Param('id') id: string, @Body() dto: UpdateSupportTicketDto) {
    return this.ticketsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a ticket' })
  remove(@Param('id') id: string) {
    return this.ticketsService.remove(id);
  }
}
