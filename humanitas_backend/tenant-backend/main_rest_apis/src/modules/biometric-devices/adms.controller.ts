import { Controller, Get, Post, Query, Body, Req, Res, Logger } from '@nestjs/common';
import { AdmsService } from './adms.service';
import type { Request, Response } from 'express';

@Controller('iclock')
export class AdmsController {
    private readonly logger = new Logger(AdmsController.name);

    constructor(private readonly admsService: AdmsService) { }

    /**
     * Device Handshake & Data Push
     * Endpoint: /iclock/cdata
     */
    @Get('cdata')
    async handshake(
        @Query('SN') sn: string,
        @Query('options') options: string,
        @Res() res: Response
    ) {
        if (options && options === 'all') {
            const response = await this.admsService.handleHandshake(sn);
            return res.status(200).send(response);
        }
        return res.status(200).send('OK');
    }

    @Post('cdata')
    async receiveData(
        @Query('SN') sn: string,
        @Query('table') table: string,
        @Body() body: string | Record<string, any>,
        @Req() req: Request
    ) {
        // Note: ZKTeco sends data as text/plain sometimes, but NestJS might try to parse JSON.
        // We access raw body if needed, or rely on body parser.
        // For simplicity, assuming text handling is configured or body is string.

        // Check if body is empty but data is in query or other format (common in some firmwares)
        // Actually, body is usually the POST payload.

        // In NestJS, extracting raw body text can be tricky if global JSON middleware is on.
        // We'll rely on string body if content-type is correct.

        // Workaround: If body is an object (parsed), we might need to stringify or check format.
        const rawData = typeof body === 'object' ? JSON.stringify(body) : String(body || '');

        const result = await this.admsService.receiveData(sn, table, rawData);
        return result;
    }

    /**
     * Device Command Polling
     * Endpoint: /iclock/getrequest
     */
    @Get('getrequest')
    async getRequest(@Query('SN') sn: string) {
        return this.admsService.getCommands(sn);
    }

    /**
     * Command Result Reporting
     * Endpoint: /iclock/devicecmd
     */
    @Post('devicecmd')
    async deviceCmd(@Query('SN') sn: string, @Body() body: string | Record<string, any>) {
        const rawData = typeof body === 'object' ? JSON.stringify(body) : String(body || '');
        return this.admsService.receiveCmdResult(sn, rawData);
    }
}
