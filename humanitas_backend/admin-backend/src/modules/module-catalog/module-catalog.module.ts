import { Module } from '@nestjs/common';
import { ModuleCatalogController } from './module-catalog.controller';

@Module({ controllers: [ModuleCatalogController] })
export class ModuleCatalogModule {}
