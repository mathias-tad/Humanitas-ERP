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
        @Req() req: Request,
        @Res() res: Response
    ) {
        const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || '';
        const tenantInfo = await this.admsService.resolveTenant(req, sn);
        if (options && options === 'all') {
            const response = await this.admsService.handleHandshake(sn, clientIp, tenantInfo, options);
            return res.status(200).send(response);
        }
        return res.status(200).send('OK');
    }

    @Post('cdata')
    async receiveData(
        @Query('SN') sn: string,
        @Query('table') table: string,
        @Body() body: string | Record<string, any>,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || '';
        const tenantInfo = await this.admsService.resolveTenant(req, sn);
        const rawData = typeof body === 'object' ? JSON.stringify(body) : String(body || '');

        const result = await this.admsService.receiveData(sn, table, rawData, clientIp, tenantInfo);
        return res.status(200).send(result);
    }

    /**
     * Device Command Polling
     * Endpoint: /iclock/getrequest?SN={sn}
     */
    @Get('getrequest')
    async getRequest(@Query('SN') sn: string, @Req() req: Request, @Res() res: Response) {
        const tenantInfo = await this.admsService.resolveTenant(req, sn);
        const result = await this.admsService.getCommands(sn, tenantInfo);
        return res.status(200).send(result);
    }

    /**
     * Command Result Reporting
     * Endpoint: /iclock/devicecmd?SN={sn}
     */
    @Post('devicecmd')
    async deviceCmd(
        @Query('SN') sn: string,
        @Body() body: string | Record<string, any>,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const tenantInfo = await this.admsService.resolveTenant(req, sn);
        const rawData = typeof body === 'object' ? JSON.stringify(body) : String(body || '');
        const result = await this.admsService.receiveCmdResult(sn, rawData, tenantInfo);
        return res.status(200).send(result);
    }
}
