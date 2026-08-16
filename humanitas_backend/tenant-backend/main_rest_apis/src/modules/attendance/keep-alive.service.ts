import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class KeepAliveService {
    private readonly logger = new Logger(KeepAliveService.name);

    constructor(private readonly httpService: HttpService) { }

    // Run every 13 minutes (Render sleeps after 15)
    @Cron('0 */13 * * * *')
    async keepWorkerAlive() {
        const workerUrl = process.env.WORKER_URL;
        if (!workerUrl) {
            return; // No worker to ping
        }

        try {
            this.logger.log(`[KeepAlive] 💓 Pinging worker at ${workerUrl}...`);
            await firstValueFrom(this.httpService.get(`${workerUrl}/api/v1/health`));
            this.logger.log('[KeepAlive] ✅ Worker responded.');
        } catch (error) {
            if (error.code === 'ENOTFOUND' || error.message.includes('ENOTFOUND')) {
                this.logger.warn(
                    `[KeepAlive] ⚠️ Worker not found at ${workerUrl}. If running locally, this is expected unless configured.`,
                );
            } else {
                this.logger.error(
                    `[KeepAlive] ❌ Failed to ping worker: ${error.message}`,
                );
            }
        }
    }
}
