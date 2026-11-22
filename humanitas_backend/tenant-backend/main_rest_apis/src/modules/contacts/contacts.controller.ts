import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { catalogContext } from '../products/products.context';
import { CONTACT_CATEGORY_PERMISSIONS as CP, CONTACT_PERMISSIONS as P } from './contacts.permissions';
import { ContactsService } from './contacts.service';
import {
  ContactCategoryDto, ContactInteractionDto, CreateContactDto, DuplicatesQueryDto, ListContactsQueryDto, UpdateContactCategoryDto, UpdateContactDto,
} from './dto/contacts.dto';

/** Contacts: companies and people every module shares ('contacts' opens with any module that has customers or vendors). */
@Controller('contacts')
@RequireModule('contacts')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  /** GET /contacts?role=customer|vendor&contact_type=company|person&parent_id=…&q=… */
  @Get()
  @RequirePermissions(P.view)
  list(@Request() req: AuthenticatedRequest, @Query() q: ListContactsQueryDto) {
    return this.contacts.list(catalogContext(req), q);
  }

  /** Contacts that look like the one being entered: GET /contacts/duplicates?tin=…&phone=…&email=… */
  @Get('duplicates')
  @RequirePermissions(P.view)
  duplicates(@Request() req: AuthenticatedRequest, @Query() q: DuplicatesQueryDto) {
    return this.contacts.duplicates(catalogContext(req), q);
  }

  @Get('export.csv')
  @RequirePermissions(P.export)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="contacts.csv"')
  exportCsv(@Request() req: AuthenticatedRequest, @Query() q: ListContactsQueryDto) {
    return this.contacts.exportCsv(catalogContext(req), q);
  }

  @Get(':id')
  @RequirePermissions(P.view)
  get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.get(catalogContext(req), id);
  }

  @Get(':id/timeline')
  @RequirePermissions(P.view)
  timeline(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.contacts.timelineFor(catalogContext(req), id, { limit: limit ? Number(limit) : undefined, before });
  }

  /** A company (with people), or a person (with parent_id for their company). */
  @Post()
  @RequirePermissions(P.create)
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateContactDto) {
    return this.contacts.create(catalogContext(req), dto);
  }

  @Patch(':id')
  @RequirePermissions(P.edit)
  update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactDto) {
    return this.contacts.update(catalogContext(req), id, dto);
  }

  /** Archives the contact (rule 24); POST :id/restore brings it back. */
  @Delete(':id')
  @RequirePermissions(P.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.archive(catalogContext(req), id);
  }

  @Post(':id/restore')
  @RequirePermissions(P.restore)
  restore(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.restore(catalogContext(req), id);
  }

  /** Log a call, meeting, email, visit or note (communication history). */
  @Post(':id/interactions')
  @RequirePermissions(P.edit)
  addInteraction(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ContactInteractionDto) {
    return this.contacts.addInteraction(catalogContext(req), id, dto);
  }
}

@Controller('contact-categories')
@RequireModule('contacts')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class ContactCategoriesController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @RequirePermissions(CP.view)
  list(@Request() req: AuthenticatedRequest, @Query('include_archived') includeArchived?: string) {
    return this.contacts.listCategories(catalogContext(req), includeArchived === 'true');
  }

  @Post()
  @RequirePermissions(CP.create)
  create(@Request() req: AuthenticatedRequest, @Body() dto: ContactCategoryDto) {
    return this.contacts.createCategory(catalogContext(req), dto);
  }

  @Patch(':id')
  @RequirePermissions(CP.edit)
  update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactCategoryDto) {
    return this.contacts.updateCategory(catalogContext(req), id, dto);
  }

  @Delete(':id')
  @RequirePermissions(CP.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.archiveCategory(catalogContext(req), id);
  }
}
