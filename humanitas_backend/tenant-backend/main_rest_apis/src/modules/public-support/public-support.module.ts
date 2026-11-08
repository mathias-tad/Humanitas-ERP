import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformKnowledge } from './entities/platform-knowledge.entity';
import { SupportTicket } from './entities/support-ticket.entity';
import { PublicSupportService } from './public-support.service';
import { PublicSupportController } from './public-support.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformKnowledge, SupportTicket])],
  controllers: [PublicSupportController],
  providers: [PublicSupportService],
  exports: [PublicSupportService],
})
export class PublicSupportModule {}
