import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SearchIndexController } from './search-index.controller';

/** Ctrl+K search index (featureslist §11). */
@Module({ imports: [DatabaseModule], controllers: [SearchIndexController] })
export class SearchIndexModule {}
