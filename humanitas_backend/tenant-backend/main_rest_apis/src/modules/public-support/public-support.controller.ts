import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PublicSupportService } from './public-support.service';
import { LandingAiChatDto, CreatePublicTicketDto } from './dto/public-support.dto';

@ApiTags('Public Platform Support & Landing AI')
@Controller('public')
export class PublicSupportController {
  constructor(private readonly supportService: PublicSupportService) {}

  @Get('landing-ai/status')
  @ApiOperation({ summary: 'Check if landing AI assistant is online and available' })
  getAiStatus() {
    return this.supportService.getAiStatus();
  }

  @Post('landing-ai/chat')
  @ApiOperation({ summary: 'Landing page AI chat with zero-guessing and ticket drafting' })
  chat(@Body() dto: LandingAiChatDto) {
    // In Humanitas-ERP, isHrmsOnly is false
    return this.supportService.landingAiChat(dto, false);
  }

  @Post('support-tickets')
  @ApiOperation({ summary: 'Create support ticket (direct or AI-generated)' })
  createTicket(@Body() dto: CreatePublicTicketDto) {
    return this.supportService.createTicket(dto);
  }

  @Get('platform-knowledge')
  @ApiOperation({ summary: 'Get published SaaS FAQs & knowledge for Help Center' })
  getKnowledge(@Query('category') category?: string) {
    return this.supportService.getPublishedKnowledge(category);
  }

  @Get('support-tickets/track/:ticketNumber')
  @ApiOperation({ summary: 'Track support ticket status by ticket number' })
  trackTicket(
    @Param('ticketNumber') ticketNumber: string,
    @Query('email') email: string,
  ) {
    return this.supportService.trackTicket(ticketNumber, email);
  }
}
