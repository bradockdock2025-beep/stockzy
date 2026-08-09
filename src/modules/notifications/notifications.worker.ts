import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as handlebars from 'handlebars';
import { Resend } from 'resend';
import { parseRedisUrl } from '../../common/redis/redis.utils';
import { NOTIFICATIONS_QUEUE_NAME } from './notifications.queue.constants';
import { EmailJobPayload } from './notifications.queue.service';

@Injectable()
export class NotificationsWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;
  private resend?: Resend;
  private from?: string;
  private readonly logger = new Logger(NotificationsWorker.name);
  private readonly templateCache = new Map<string, HandlebarsTemplateDelegate>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured. Notifications worker disabled.');
      return;
    }

    const apiKey = this.configService.get<string>('MAIL_PASS', '');
    if (!apiKey) {
      this.logger.warn('MAIL_PASS (Resend API key) not configured. Notifications worker disabled.');
      return;
    }

    this.resend = new Resend(apiKey);
    this.from = this.configService.get<string>('MAIL_FROM', '"Stockzy" <noreply@stockzy.com>');

    this.worker = new Worker(
      NOTIFICATIONS_QUEUE_NAME,
      async (job) => {
        if (job.name !== 'send.email') return;

        const payload = job.data as EmailJobPayload;
        const html = this.renderTemplate(payload.template, payload.context);

        const { error } = await this.resend!.emails.send({
          from: this.from!,
          to: payload.to,
          subject: payload.subject,
          html,
        });

        if (error) {
          throw new Error(`Resend error: ${error.message}`);
        }

        this.logger.log(`Email sent: template=${payload.template} to=${payload.to}`);
      },
      { connection: parseRedisUrl(redisUrl) },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Email job failed. id=${job?.id} template=${job?.data?.template} to=${job?.data?.to} error=${error instanceof Error ? error.message : String(error)}`,
      );
    });

    this.worker.on('error', (error) => {
      this.logger.error(`Notifications worker error: ${error instanceof Error ? error.message : String(error)}`);
    });

    this.logger.log('Notifications worker started.');
  }

  private renderTemplate(templateName: string, context: Record<string, unknown>): string {
    if (!this.templateCache.has(templateName)) {
      const distPath = join(__dirname, 'templates', templateName);
      const srcPath = join(process.cwd(), 'src/modules/notifications/templates', templateName);
      const filePath = existsSync(distPath) ? distPath : srcPath;
      const source = readFileSync(filePath, 'utf-8');
      this.templateCache.set(templateName, handlebars.compile(source));
    }

    return this.templateCache.get(templateName)!(context);
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
