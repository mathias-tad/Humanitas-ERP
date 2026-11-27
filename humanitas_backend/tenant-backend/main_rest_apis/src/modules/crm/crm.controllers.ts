import { BadRequestException, Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { catalogContext } from '../../common/records/record-context';
import { ACTIVITY_PERMISSIONS as A, CRM_SETUP_PERMISSIONS as S, LEAD_PERMISSIONS as L, OPPORTUNITY_PERMISSIONS as O } from './crm.permissions';
import { CrmLeadsService } from './crm-leads.service';
import { CrmOpportunitiesService } from './crm-opportunities.service';
import { CrmActivitiesService } from './crm-activities.service';
import { CrmSetupService } from './crm-setup.service';
import { CrmImportService, type ImportKind, type ImportMode, type ImportOptions } from './crm-import.service';
import { CrmFollowUpsService } from './crm-follow-ups.service';
import { LogFollowUpDto } from './dto/follow-up.dto';
import {
  BoardQueryDto, CompleteActivityDto, ConvertLeadDto, CreateActivityDto, CreateLeadDto, CreateOpportunityDto, ForecastQueryDto,
  ListActivitiesQueryDto, ListItemDto, ListLeadsQueryDto, ListOpportunitiesQueryDto, LoseDto, MoveStageDto, PipelineDto, ReorderStagesDto,
  StageDto, UpdateActivityDto, UpdateLeadDto, UpdateListItemDto, UpdateOpportunityDto, UpdatePipelineDto, UpdateStageDto,
} from './dto/crm.dto';

const timelineOpts = (limit?: string, before?: string) => ({ limit: limit ? Number(limit) : undefined, before });

/** multipart/form-data: file, mode (preview | check | import), mapping (JSON: field -> column), options (JSON). */
async function importRequest(req: AuthenticatedRequest) {
  const part = await (req as unknown as { file?: () => Promise<any> }).file?.();
  if (!part) throw new BadRequestException('Choose a file');
  const data: Buffer = await part.toBuffer();
  if (part.file?.truncated) throw new BadRequestException('The file is larger than 5 MB; split it');
  const field = (k: string): string | undefined => part.fields?.[k]?.value;
  const json = (k: string) => {
    const v = field(k);
    if (!v) return undefined;
    try {
      return JSON.parse(v);
    } catch {
      throw new BadRequestException(`${k} is not valid`);
    }
  };
  const mode = (field('mode') ?? 'preview') as ImportMode;
  if (!['preview', 'check', 'import'].includes(mode)) throw new BadRequestException('mode is preview, check or import');
  const mapping = json('mapping');
  if (mapping !== undefined && (typeof mapping !== 'object' || Array.isArray(mapping) || mapping === null)) throw new BadRequestException('mapping is not valid');
  const raw = (json('options') ?? {}) as Record<string, unknown>;
  const options: ImportOptions = {
    create_missing_sources: raw.create_missing_sources === true,
    create_missing_customers: raw.create_missing_customers === true,
    default_owner: raw.default_owner === 'none' ? 'none' : 'me',
  };
  return { file: { data, filename: String(part.filename ?? 'import.csv') }, mode, mapping: mapping as Record<string, number> | undefined, options };
}

async function runImport(importer: CrmImportService, req: AuthenticatedRequest, kind: ImportKind) {
  const r = await importRequest(req);
  return importer.run(catalogContext(req), kind, r.file, r.mode, r.mapping, r.options);
}

/** Leads (CRM 1.1). */
@Controller('crm/leads')
@RequireModule('crm')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class CrmLeadsController {
  constructor(
    private readonly leads: CrmLeadsService,
    private readonly importer: CrmImportService,
    private readonly followUps: CrmFollowUpsService,
  ) {}

  @Get(':id/follow-ups')
  @RequirePermissions(L.view)
  listFollowUps(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Query('limit') limit?: string, @Query('before') before?: string) {
    return this.followUps.list(catalogContext(req), 'lead', id, timelineOpts(limit, before));
  }

  /** Log a contact that already happened (call, meeting, visit, email, Telegram, WhatsApp, SMS or a note), optionally with the next step. */
  @Post(':id/follow-ups')
  @RequirePermissions(L.edit)
  logFollowUp(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LogFollowUpDto) {
    return this.followUps.log(catalogContext(req), 'lead', id, dto);
  }

  /** Import leads from Excel or CSV: mode=preview, then check, then import. */
  @Post('import')
  @RequirePermissions(L.create)
  importLeads(@Request() req: AuthenticatedRequest) {
    return runImport(this.importer, req, 'leads');
  }

  @Get()
  @RequirePermissions(L.view)
  list(@Request() req: AuthenticatedRequest, @Query() q: ListLeadsQueryDto) {
    return this.leads.list(catalogContext(req), q);
  }

  @Get('export.csv')
  @RequirePermissions(L.export)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="leads.csv"')
  exportCsv(@Request() req: AuthenticatedRequest, @Query() q: ListLeadsQueryDto) {
    return this.leads.exportCsv(catalogContext(req), q);
  }

  @Get(':id')
  @RequirePermissions(L.view)
  get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.get(catalogContext(req), id);
  }

  @Get(':id/timeline')
  @RequirePermissions(L.view)
  timeline(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Query('limit') limit?: string, @Query('before') before?: string) {
    return this.leads.timelineFor(catalogContext(req), id, timelineOpts(limit, before));
  }

  @Post()
  @RequirePermissions(L.create)
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateLeadDto) {
    return this.leads.create(catalogContext(req), dto);
  }

  @Patch(':id')
  @RequirePermissions(L.edit)
  update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.update(catalogContext(req), id, dto);
  }

  @Post(':id/lose')
  @RequirePermissions(L.edit)
  lose(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LoseDto) {
    return this.leads.markLost(catalogContext(req), id, dto);
  }

  /** Convert into a contact (new or existing) and, unless told not to, an opportunity. */
  @Post(':id/convert')
  @RequirePermissions(L.edit)
  convert(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConvertLeadDto) {
    return this.leads.convert(catalogContext(req), id, dto);
  }

  @Delete(':id')
  @RequirePermissions(L.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.archive(catalogContext(req), id);
  }

  @Post(':id/restore')
  @RequirePermissions(L.restore)
  restore(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.restore(catalogContext(req), id);
  }
}

/** Opportunities, the pipeline board and the forecast (CRM 1.2, 1.4). */
@Controller('crm/opportunities')
@RequireModule('crm')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class CrmOpportunitiesController {
  constructor(
    private readonly deals: CrmOpportunitiesService,
    private readonly importer: CrmImportService,
    private readonly followUps: CrmFollowUpsService,
  ) {}

  @Get(':id/follow-ups')
  @RequirePermissions(O.view)
  listFollowUps(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Query('limit') limit?: string, @Query('before') before?: string) {
    return this.followUps.list(catalogContext(req), 'opportunity', id, timelineOpts(limit, before));
  }

  /** Log a contact that already happened (call, meeting, visit, email, Telegram, WhatsApp, SMS or a note), optionally with the next step. */
  @Post(':id/follow-ups')
  @RequirePermissions(O.edit)
  logFollowUp(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LogFollowUpDto) {
    return this.followUps.log(catalogContext(req), 'opportunity', id, dto);
  }

  /** Import deals from Excel or CSV: mode=preview, then check, then import. */
  @Post('import')
  @RequirePermissions(O.create)
  importDeals(@Request() req: AuthenticatedRequest) {
    return runImport(this.importer, req, 'opportunities');
  }

  @Get()
  @RequirePermissions(O.view)
  list(@Request() req: AuthenticatedRequest, @Query() q: ListOpportunitiesQueryDto) {
    return this.deals.list(catalogContext(req), q);
  }

  @Get('board')
  @RequirePermissions(O.view)
  board(@Request() req: AuthenticatedRequest, @Query() q: BoardQueryDto) {
    return this.deals.board(catalogContext(req), q);
  }

  @Get('forecast')
  @RequirePermissions(O.view)
  forecast(@Request() req: AuthenticatedRequest, @Query() q: ForecastQueryDto) {
    return this.deals.forecast(catalogContext(req), q);
  }

  @Get('export.csv')
  @RequirePermissions(O.export)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="opportunities.csv"')
  exportCsv(@Request() req: AuthenticatedRequest, @Query() q: ListOpportunitiesQueryDto) {
    return this.deals.exportCsv(catalogContext(req), q);
  }

  @Get(':id')
  @RequirePermissions(O.view)
  get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.get(catalogContext(req), id);
  }

  @Get(':id/timeline')
  @RequirePermissions(O.view)
  timeline(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Query('limit') limit?: string, @Query('before') before?: string) {
    return this.deals.timelineFor(catalogContext(req), id, timelineOpts(limit, before));
  }

  @Post()
  @RequirePermissions(O.create)
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateOpportunityDto) {
    return this.deals.create(catalogContext(req), dto);
  }

  @Patch(':id')
  @RequirePermissions(O.edit)
  update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOpportunityDto) {
    return this.deals.update(catalogContext(req), id, dto);
  }

  /** Move to another stage (drag on the board). */
  @Post(':id/stage')
  @RequirePermissions(O.edit)
  move(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveStageDto) {
    return this.deals.moveStage(catalogContext(req), id, dto.stage_id);
  }

  @Post(':id/won')
  @RequirePermissions(O.edit)
  won(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.markWon(catalogContext(req), id);
  }

  @Post(':id/lose')
  @RequirePermissions(O.edit)
  lose(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LoseDto) {
    return this.deals.markLost(catalogContext(req), id, dto);
  }

  @Post(':id/reopen')
  @RequirePermissions(O.edit)
  reopen(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.reopen(catalogContext(req), id);
  }

  @Delete(':id')
  @RequirePermissions(O.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.archive(catalogContext(req), id);
  }

  @Post(':id/restore')
  @RequirePermissions(O.restore)
  restore(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.restore(catalogContext(req), id);
  }
}

/** Planned calls, meetings, emails, visits and to-dos (CRM 1.5). */
@Controller('crm/activities')
@RequireModule('crm')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class CrmActivitiesController {
  constructor(private readonly activities: CrmActivitiesService) {}

  /** GET /crm/activities?assigned_to=me|all|<user>&when=overdue|today|upcoming|open|done&tz=Africa/Addis_Ababa */
  @Get()
  @RequirePermissions(A.view)
  list(@Request() req: AuthenticatedRequest, @Query() q: ListActivitiesQueryDto, @Query('tz') tz?: string) {
    return this.activities.list(catalogContext(req), { ...q, tz });
  }

  @Get('summary')
  @RequirePermissions(A.view)
  summary(@Request() req: AuthenticatedRequest, @Query('tz') tz?: string) {
    return this.activities.summary(catalogContext(req), tz);
  }

  @Get(':id')
  @RequirePermissions(A.view)
  get(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.activities.get(catalogContext(req), id);
  }

  @Post()
  @RequirePermissions(A.create)
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateActivityDto) {
    return this.activities.create(catalogContext(req), dto);
  }

  @Patch(':id')
  @RequirePermissions(A.edit)
  update(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateActivityDto) {
    return this.activities.update(catalogContext(req), id, dto);
  }

  @Post(':id/done')
  @RequirePermissions(A.edit)
  done(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteActivityDto) {
    return this.activities.complete(catalogContext(req), id, dto);
  }

  @Delete(':id')
  @RequirePermissions(A.delete)
  archive(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.activities.archive(catalogContext(req), id);
  }
}

/** CRM set-up: pipelines and stages, lead sources, lost reasons. */
@Controller('crm/setup')
@RequireModule('crm')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class CrmSetupController {
  constructor(private readonly setup: CrmSetupService) {}

  @Get('pipelines')
  @RequirePermissions(S.view)
  pipelines(@Request() req: AuthenticatedRequest, @Query('include_archived') includeArchived?: string) {
    return this.setup.pipelines(catalogContext(req), includeArchived === 'true');
  }

  @Post('pipelines')
  @RequirePermissions(S.create)
  createPipeline(@Request() req: AuthenticatedRequest, @Body() dto: PipelineDto) {
    return this.setup.createPipeline(catalogContext(req), dto);
  }

  @Patch('pipelines/:id')
  @RequirePermissions(S.edit)
  updatePipeline(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePipelineDto) {
    return this.setup.updatePipeline(catalogContext(req), id, dto);
  }

  @Post('pipelines/:id/stages')
  @RequirePermissions(S.create)
  addStage(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StageDto) {
    return this.setup.addStage(catalogContext(req), id, dto);
  }

  @Post('pipelines/:id/stages/order')
  @RequirePermissions(S.edit)
  reorder(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderStagesDto) {
    return this.setup.reorderStages(catalogContext(req), id, dto);
  }

  @Patch('stages/:id')
  @RequirePermissions(S.edit)
  updateStage(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStageDto) {
    return this.setup.updateStage(catalogContext(req), id, dto);
  }

  @Delete('stages/:id')
  @RequirePermissions(S.delete)
  archiveStage(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.setup.archiveStage(catalogContext(req), id);
  }

  @Get('sources')
  @RequirePermissions(S.view)
  sources(@Request() req: AuthenticatedRequest, @Query('include_archived') includeArchived?: string) {
    return this.setup.listItems(catalogContext(req), 'crm_lead_sources', includeArchived === 'true');
  }

  @Post('sources')
  @RequirePermissions(S.create)
  createSource(@Request() req: AuthenticatedRequest, @Body() dto: ListItemDto) {
    return this.setup.createItem(catalogContext(req), 'crm_lead_sources', dto);
  }

  @Patch('sources/:id')
  @RequirePermissions(S.edit)
  updateSource(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateListItemDto) {
    return this.setup.updateItem(catalogContext(req), 'crm_lead_sources', id, dto);
  }

  @Get('lost-reasons')
  @RequirePermissions(S.view)
  lostReasons(@Request() req: AuthenticatedRequest, @Query('include_archived') includeArchived?: string) {
    return this.setup.listItems(catalogContext(req), 'crm_lost_reasons', includeArchived === 'true');
  }

  @Post('lost-reasons')
  @RequirePermissions(S.create)
  createLostReason(@Request() req: AuthenticatedRequest, @Body() dto: ListItemDto) {
    return this.setup.createItem(catalogContext(req), 'crm_lost_reasons', dto);
  }

  @Patch('lost-reasons/:id')
  @RequirePermissions(S.edit)
  updateLostReason(@Request() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateListItemDto) {
    return this.setup.updateItem(catalogContext(req), 'crm_lost_reasons', id, dto);
  }
}
