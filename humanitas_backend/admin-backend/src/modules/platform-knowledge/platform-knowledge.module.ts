import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformKnowledge } from './entities/platform-knowledge.entity';
import { PlatformKnowledgeService } from './platform-knowledge.service';
import { PlatformKnowledgeController } from './platform-knowledge.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformKnowledge])],
  controllers: [PlatformKnowledgeController],
  providers: [PlatformKnowledgeService],
  exports: [PlatformKnowledgeService],
})
export class PlatformKnowledgeModule {}
