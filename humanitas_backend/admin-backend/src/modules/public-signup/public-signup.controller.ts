import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicSignupService } from './public-signup.service';
import { PublicSignupDto } from './dto/public-signup.dto';
import { clientIp } from './signup-rules';

/** Public (no sign-in) endpoints behind the website's "Start free trial" page. */
@ApiTags('Public sign-up')
@Controller('public/signup')
export class PublicSignupController {
  constructor(private readonly signupService: PublicSignupService) {}

  @Get('options')
  @ApiOperation({ summary: 'Whether sign-up is open, the free-trial length and the module list' })
  options() {
    return this.signupService.options();
  }

  @Get('slug-available')
  @ApiOperation({ summary: 'Whether a organization ID can be used' })
  slugAvailable(@Query('slug') slug: string) {
    return this.signupService.slugAvailable(slug ?? '');
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Start a free trial: creates the tenant and emails the set-up link' })
  signup(
    @Body() dto: PublicSignupDto,
    @Req() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.signupService.signup(dto, clientIp(req));
  }
}
