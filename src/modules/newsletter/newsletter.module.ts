import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { NewsletterAdminController } from './newsletter.admin.controller';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';

@Module({
  imports: [DatabaseModule],
  controllers: [NewsletterController, NewsletterAdminController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
