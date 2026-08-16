import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SetupService } from './setup.service';

@ApiTags('Setup')
@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status/:slug')
  @ApiOperation({ summary: 'Check tenant setup status' })
  checkSetupStatus(@Param('slug') slug: string) {
    return this.setupService.checkSetupStatus(slug);
  }

  @Get('token')
  @ApiOperation({ summary: 'Get tenant info by setup token' })
  getTenantBySetupToken(@Query('token') token: string) {
    return this.setupService.getTenantSetupInfo(token);
  }
}
