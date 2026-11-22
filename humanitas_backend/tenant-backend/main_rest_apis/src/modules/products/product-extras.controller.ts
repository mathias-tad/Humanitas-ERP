import { BadRequestException, Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { catalogContext } from './products.context';
import { PRICE_LIST_PERMISSIONS, PRODUCT_PERMISSIONS as P, PRODUCT_REPORT_PERMISSIONS as R, PRODUCT_SETTINGS_PERMISSIONS as S } from './products.permissions';
import { ProductSettingsService } from './product-settings.service';
import { ProductReportsService } from './product-reports.service';
import { ProductStructureService } from './product-structure.service';
import { ProductMediaService } from './product-media.service';
import { PriceListCustomersService } from './price-list-customers.service';
import {
  ReorderMediaDto, ReportQueryDto, SaveCompositionDto, SavePackagingsDto, SetPriceListCustomersDto, UpdateMediaDto, UpdateProductSettingsDto,
} from './dto/product-extras.dto';

/** Product Settings: numbering, defaults for new products, required fields. */
@Controller('product-settings')
@RequireModule('products')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class ProductSettingsController {
  constructor(private readonly settings: ProductSettingsService) {}

  @Get()
  @RequirePermissions(S.view)
  get(@Request() req: AuthenticatedRequest) {
    return this.settings.get(catalogContext(req));
  }

  @Patch()
  @RequirePermissions(S.edit)
  update(@Request() req: AuthenticatedRequest, @Body() dto: UpdateProductSettingsDto) {
    return this.settings.update(catalogContext(req), dto);
  }
}

/** Product Reports: catalog make-up, margins and gaps. */
@Controller('product-reports')
@RequireModule('products')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class ProductReportsController {
  constructor(private readonly reports: ProductReportsService) {}

  @Get('summary')
  @RequirePermissions(R.view)
  summary(@Request() req: AuthenticatedRequest, @Query() q: ReportQueryDto) {
    return this.reports.summary(catalogContext(req), q);
  }

  @Get('issues.csv')
  @RequirePermissions(R.export)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="catalog-gaps.csv"')
  issuesCsv(@Request() req: AuthenticatedRequest, @Query() q: ReportQueryDto) {
    return this.reports.exportCsv(catalogContext(req), q);
  }
}

/** A product's packaging, kit or combo contents, pictures and attachments. */
@Controller('products')
@RequireModule('products')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class ProductStructureController {
  constructor(
    private readonly structure: ProductStructureService,
    private readonly media: ProductMediaService,
  ) {}

  @Get(':id/packagings')
  @RequirePermissions(P.view)
  packagings(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.structure.packagings(catalogContext(req), id);
  }

  @Put(':id/packagings')
  @RequirePermissions(P.edit)
  savePackagings(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SavePackagingsDto) {
    return this.structure.savePackagings(catalogContext(req), id, dto);
  }

  @Get(':id/composition')
  @RequirePermissions(P.view)
  composition(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.structure.composition(catalogContext(req), id);
  }

  @Put(':id/composition')
  @RequirePermissions(P.edit)
  saveComposition(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveCompositionDto) {
    return this.structure.saveComposition(catalogContext(req), id, dto);
  }

  @Get(':id/media')
  @RequirePermissions(P.view)
  listMedia(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.media.list(catalogContext(req), id);
  }

  /** multipart/form-data: file, kind (image | attachment), title. */
  @Post(':id/media')
  @RequirePermissions(P.edit)
  async upload(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    const part = await (req as unknown as { file?: () => Promise<any> }).file?.();
    if (!part) throw new BadRequestException('Choose a file');
    const data: Buffer = await part.toBuffer();
    if (part.file?.truncated) throw new BadRequestException('The file is larger than 5 MB');
    return this.media.upload(catalogContext(req), id, { data, filename: part.filename, mimetype: part.mimetype }, {
      kind: part.fields?.kind?.value, title: part.fields?.title?.value,
    });
  }

  @Post(':id/media/order')
  @RequirePermissions(P.edit)
  reorderMedia(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderMediaDto) {
    return this.media.reorder(catalogContext(req), id, dto);
  }

  @Patch(':id/media/:mediaId')
  @RequirePermissions(P.edit)
  updateMedia(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Param('mediaId', ParseUUIDPipe) mediaId: string, @Body() dto: UpdateMediaDto) {
    return this.media.update(catalogContext(req), id, mediaId, dto);
  }

  @Delete(':id/media/:mediaId')
  @RequirePermissions(P.edit)
  removeMedia(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Param('mediaId', ParseUUIDPipe) mediaId: string) {
    return this.media.archive(catalogContext(req), id, mediaId);
  }
}

/** Customers on a price list. */
@Controller('price-lists')
@RequireModule('products')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class PriceListCustomersController {
  constructor(private readonly customers: PriceListCustomersService) {}

  @Get('for-customer/:contactId')
  @RequirePermissions(PRICE_LIST_PERMISSIONS.view)
  forCustomer(@Request() req: AuthenticatedRequest, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.customers.forCustomer(catalogContext(req), contactId);
  }

  @Get(':id/customers')
  @RequirePermissions(PRICE_LIST_PERMISSIONS.view)
  list(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.customers(catalogContext(req), id);
  }

  @Put(':id/customers')
  @RequirePermissions(PRICE_LIST_PERMISSIONS.edit)
  set(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPriceListCustomersDto) {
    return this.customers.setCustomers(catalogContext(req), id, dto.contact_ids);
  }
}
