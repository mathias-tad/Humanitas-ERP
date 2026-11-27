import { Module, type OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../database/database.module';
import { Tenant } from '../auth/entities/tenant.entity';
import {
  InventoryLocationsController,
  InventoryStockController,
  InventoryTransfersController,
  InventoryWarehousesController,
} from './inventory.controllers';
import { WarehousesService } from './warehouses.service';
import { StockService } from './stock.service';
import { TransfersService } from './transfers.service';
import { ValuationClient } from './valuation-client';
import { ModuleHooksService } from '../../common/modules/module-hooks.service';
import { registerInventoryHooks } from './inventory.hooks';

/**
 * Inventory & Warehouse Management (featureslist §2). Depends on Products (module map, rule 30):
 * it reads products and plugs into Products' events through ModuleHooksService (a product with
 * stock cannot be archived); Products never imports it. ActivityTimelineService and
 * ModuleHooksService come from global platform modules.
 */
@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([Tenant])],
  controllers: [InventoryWarehousesController, InventoryLocationsController, InventoryStockController, InventoryTransfersController],
  providers: [WarehousesService, StockService, TransfersService, ValuationClient],
  exports: [WarehousesService, StockService, TransfersService],
})
export class InventoryModule implements OnModuleInit {
  constructor(private readonly hooks: ModuleHooksService) {}

  onModuleInit(): void {
    registerInventoryHooks(this.hooks);
  }
}
