import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { internalServiceHeaders } from '../ai/internal-service-headers';

/**
 * Valuation is computed by the Python calculation service (AGENTS.md rule 8): NestJS records the
 * quantities and the costs in the ledger, and this client hands the moves over to
 * `/api/inventory/valuation` so the FIFO layers and AVCO averages are written on the engine's
 * clock. The call is best-effort on purpose — the stock has already moved atomically; a slow or
 * absent engine must not block a warehouse receipt, it just means the layers catch up.
 *
 * The request carries the shared internal-service headers (`x-internal-service` /
 * `x-internal-service-key`), the same way the AI module calls the admin backend, so the engine can
 * tell an authenticated tenant-backend call from anything else.
 */
export interface ValuationMove {
  move_id: string;
  product_id: string;
  lot_id?: string | null;
  from_location_id?: string | null;
  to_location_id?: string | null;
  quantity: number | string;
  unit_cost: number | string;
  /** The engine keeps each company's FIFO layers apart. */
  company_id?: string | null;
  branch_id?: string | null;
}

const valuationServiceUrl = (configService: ConfigService): string =>
  configService.get<string>('CALCULATION_SERVICE_URL') || 'http://localhost:8000';

@Injectable()
export class ValuationClient {
  private readonly logger = new Logger(ValuationClient.name);

  constructor(private readonly configService: ConfigService) {}

  async notify(tenantId: string, moves: ValuationMove[]): Promise<boolean> {
    if (!moves.length) return true;
    try {
      const res = await fetch(`${valuationServiceUrl(this.configService)}/api/inventory/valuation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
          ...internalServiceHeaders(this.configService),
        },
        body: JSON.stringify({ tenant_id: tenantId, moves }),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch (e) {
      // Engine down: the ledger is correct, the layers are recomputed on its next run.
      this.logger.warn(`inventory valuation call failed: ${(e as Error).message}`);
      return false;
    }
  }
}
