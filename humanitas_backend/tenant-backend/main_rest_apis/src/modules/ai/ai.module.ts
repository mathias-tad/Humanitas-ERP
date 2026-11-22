import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiDocumentController } from './ai-document.controller';
import { AiLifecycleController } from './ai-lifecycle.controller';
import { AiService } from './ai.service';
import { RoleContextBuilderService } from './services/role-context-builder.service';
import { AgentToolRouterService } from './services/agent-tool-router.service';
import { AiDbQueryService } from './services/ai-db-query.service';
import { AiDocumentService } from './services/ai-document.service';
import { AiOnboardingService } from './services/ai-onboarding.service';
import { AiPerformanceService } from './services/ai-performance.service';
import { AiAttritionService } from './services/ai-attrition.service';
import { AiUsageService } from './services/ai-usage.service';
import { AiConversationService } from './services/ai-conversation.service';
import { AiSettingsFetchService } from './services/ai-settings-fetch.service';
import { AiUsageController } from './ai-usage.controller';
import { AiConversationController } from './ai-conversation.controller';
import { DatabaseModule } from '../database/database.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { AiAnalyticsService } from './services/ai-analytics.service';
import { AiActionService } from './services/ai-action.service';
import { AiFileParserService } from './services/ai-file-parser.service';
import { AiSettingsConfigService } from './ai-settings.service';
import { AiSettingsController } from './ai-settings.controller';
import { TenantAiKnowledgeService } from './services/tenant-ai-knowledge.service';
import { DiscoveryModule } from '@nestjs/core';
import { AppActionCatalogService } from './services/app-action-catalog.service';
import { AiAppActionsService } from './services/ai-app-actions.service';
import { AiRequestContextInterceptor } from './services/ai-request-context';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([Tenant]),
    DiscoveryModule,
  ],
  controllers: [
    AiController, 
    AiDocumentController, 
    AiLifecycleController, 
    AiUsageController,
    AiConversationController,
    AiSettingsController,
  ],
  providers: [
    AiService,
    RoleContextBuilderService,
    AgentToolRouterService,
    AiDbQueryService,
    AiDocumentService,
    AiOnboardingService,
    AiPerformanceService,
    AiAttritionService,
    AiUsageService,
    AiConversationService,
    AiSettingsFetchService,
    AiAnalyticsService,
    AiActionService,
    AiFileParserService,
    AiSettingsConfigService,
    TenantAiKnowledgeService,
    AppActionCatalogService,
    AiAppActionsService,
    AiRequestContextInterceptor,
  ],
  exports: [
    AiService, 
    AiDocumentService, 
    AiOnboardingService, 
    AiPerformanceService, 
    AiAttritionService, 
    AiUsageService,
    AiConversationService,
    AiSettingsFetchService,
    TenantAiKnowledgeService,
  ],
})
export class AiModule {}

