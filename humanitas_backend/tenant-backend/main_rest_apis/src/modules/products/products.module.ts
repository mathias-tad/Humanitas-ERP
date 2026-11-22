import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../database/database.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { ProductsController } from './products.controller';
import { ProductCategoriesController } from './product-categories.controller';
import { UomsController } from './uoms.controller';
import { ProductsService } from './products.service';
import { ProductCategoriesService } from './product-categories.service';
import { UomsService } from './uoms.service';
import { ProductAttributesController } from './product-attributes.controller';
import { ProductAttributesService } from './product-attributes.service';
import { ProductVariantsService } from './product-variants.service';

/** Products & Catalog (featureslist §1). ActivityTimelineService comes from the global platform module. */
@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([Tenant])],
  controllers: [ProductsController, ProductCategoriesController, UomsController, ProductAttributesController],
  providers: [ProductsService, ProductCategoriesService, UomsService, ProductAttributesService, ProductVariantsService],
  exports: [ProductsService, ProductCategoriesService, UomsService, ProductAttributesService, ProductVariantsService],
})
export class ProductsModule {}
