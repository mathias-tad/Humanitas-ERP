import 'reflect-metadata';
import { Body, Controller, Delete, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DiscoveryModule } from '@nestjs/core';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { RequireModule } from '../../auth/guards/module-subscription.guard';
import { AppActionCatalogService, fieldsOf } from './app-action-catalog.service';
import {
  buildUrl, canUse, isBlockedPath, isCancellation, isConfirmation, joinPath, scoreAction, searchActions, type AppAction,
} from './app-action-catalog';

class CreateWidgetDto {
  @IsString() name: string;
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsIn(['red', 'blue']) color?: string;
  @IsOptional() @IsUUID() category_id?: string;
}

@Controller('widgets')
@RequireModule('products')
@UseGuards(JwtAuthGuard)
class WidgetsController {
  @Get() @RequirePermissions('view_widgets') list(@Query('q') _q?: string) { return []; }
  @Post() @RequirePermissions('create_widgets') create(@Body() _dto: CreateWidgetDto) { return {}; }
  @Delete(':id') @RequirePermissions('delete_widgets') remove(@Param('id') _id: string) { return {}; }
  @Get('export.csv') @RequirePermissions('view_widgets') @Header('Content-Type', 'text/csv') exportCsv() { return ''; }
}

@Controller('auth')
@UseGuards(JwtAuthGuard)
class AuthLikeController {
  @Post('change-password') change() { return {}; }
}

@Controller('open')
class PublicController {
  @Get() hello() { return 'hi'; }
}

describe('AI action catalog', () => {
  let catalog: AppAction[];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [DiscoveryModule],
      controllers: [WidgetsController, AuthLikeController, PublicController],
      providers: [AppActionCatalogService],
    }).compile();
    catalog = mod.get(AppActionCatalogService).build();
  });

  it('lists signed-in endpoints with permission, module, path values and fields', () => {
    const create = catalog.find((a) => a.id === 'POST /widgets')!;
    expect(create).toMatchObject({ module: 'products', permissions: ['create_widgets'] });
    expect(create.body).toEqual(expect.arrayContaining([
      { name: 'name', required: true, type: 'string' },
      { name: 'price', required: false, type: 'number' },
      { name: 'color', required: false, type: 'one of: red | blue' },
      { name: 'category_id', required: false, type: 'uuid' },
    ]));
    expect(catalog.find((a) => a.id === 'DELETE /widgets/:id')!.pathParams).toEqual(['id']);
    expect(catalog.find((a) => a.id === 'GET /widgets')!.query).toEqual([{ name: 'q', required: false, type: 'string' }]);
  });

  it('leaves out sign-in endpoints, public endpoints and file downloads', () => {
    const ids = catalog.map((a) => a.id);
    expect(ids).not.toContain('POST /auth/change-password');
    expect(ids).not.toContain('GET /open');
    expect(ids).not.toContain('GET /widgets/export.csv');
  });

  it('finds actions for a request, only among those the user may run', () => {
    expect(searchActions(catalog, 'create a widget', ['create_widgets', 'view_widgets'])[0].id).toBe('POST /widgets');
    expect(searchActions(catalog, 'delete widget', ['view_widgets']).map((a) => a.id)).not.toContain('DELETE /widgets/:id');
    expect(searchActions(catalog, 'delete widget', ['*'])[0].id).toBe('DELETE /widgets/:id');
    expect(searchActions(catalog, 'zzz', ['*'])).toEqual([]);
  });
});

describe('AI action helpers', () => {
  const a: AppAction = { id: 'PATCH /products/:id', method: 'PATCH', path: '/products/:id', module: 'products', permissions: ['edit_products'], summary: 'products: update', pathParams: ['id'], body: [], query: [] };

  it('builds safe URLs', () => {
    expect(buildUrl(a, { id: 'abc' }, { q: 'teff', page: 2, empty: '' })).toBe('/products/abc?q=teff&page=2');
    expect(buildUrl(a, { id: '../auth/x' })).toBe('/products/..%2Fauth%2Fx');
    expect(() => buildUrl(a, {})).toThrow(/Missing path value "id"/);
  });

  it('checks permissions, blocked paths and path joining', () => {
    expect(canUse(a, ['edit_products'])).toBe(true);
    expect(canUse(a, ['view_products'])).toBe(false);
    expect(canUse({ ...a, permissions: [] }, [])).toBe(true);
    expect(isBlockedPath('/auth/login')).toBe(true);
    expect(isBlockedPath('/ai/chat')).toBe(true);
    expect(isBlockedPath('/products')).toBe(false);
    expect(joinPath('products', '/', ':id')).toBe('/products/:id');
    expect(scoreAction(a, 'update product')).toBeGreaterThan(scoreAction(a, 'list employees'));
  });

  it('reads yes and no, in English and Amharic', () => {
    for (const m of ['yes', 'Yes please', 'ok', 'go ahead', 'confirm', 'አዎ', 'እሺ']) expect(isConfirmation(m)).toBe(true);
    for (const m of ['no', 'yes but not now', 'do not do it', 'what is the price?', 'wait']) expect(isConfirmation(m)).toBe(false);
    for (const m of ['no', 'cancel', 'never mind', 'አይ']) expect(isCancellation(m)).toBe(true);
    expect(isCancellation('yes')).toBe(false);
    expect(fieldsOf(String)).toEqual([]);
  });
});
