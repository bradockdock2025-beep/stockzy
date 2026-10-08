import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as handlebars from 'handlebars';
import { Resend } from 'resend';
import Twilio from 'twilio';
import { parseRedisUrl } from '../../common/redis/redis.utils';
import { NOTIFICATIONS_QUEUE_NAME } from './notifications.queue.constants';
import { EmailJobPayload, SmsJobPayload, WhatsAppJobPayload } from './notifications.queue.service';

@Injectable()
export class NotificationsWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;
  private resend?: Resend;
  private from?: string;
  private twilioClient?: Twilio.Twilio;
  private smsFrom?: string;
  private whatsappFrom?: string;
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
      this.logger.warn('MAIL_PASS (Resend API key) not configured. Email sending disabled.');
    } else {
      this.resend = new Resend(apiKey);
      this.from = this.configService.get<string>('MAIL_FROM', '"Stockzy" <noreply@stockzy.com>');
    }

    this.setupTwilio();

    this.worker = new Worker(
      NOTIFICATIONS_QUEUE_NAME,
      async (job) => {
        if (job.name === 'send.email') {
          await this.handleEmailJob(job.data as EmailJobPayload);
          return;
        }
        if (job.name === 'send.sms') {
          await this.handleSmsJob(job.data as SmsJobPayload);
          return;
        }
        if (job.name === 'send.whatsapp') {
          await this.handleWhatsAppJob(job.data as WhatsAppJobPayload);
          return;
        }
      },
      { connection: parseRedisUrl(redisUrl) },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Notification job failed. id=${job?.id} name=${job?.name} to=${job?.data?.to} error=${error instanceof Error ? error.message : String(error)}`,
      );
    });

    this.worker.on('error', (error) => {
      this.logger.error(`Notifications worker error: ${error instanceof Error ? error.message : String(error)}`);
    });

    this.logger.log('Notifications worker started.');
  }

  private async handleEmailJob(payload: EmailJobPayload): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`Email sending not configured. Skipping email to ${payload.to}.`);
      return;
    }

    const html = this.renderTemplate(payload.template, payload.context);

    const { error } = await this.resend.emails.send({
      from: this.from!,
      to: payload.to,
      subject: payload.subject,
      html,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    this.logger.log(`Email sent: template=${payload.template} to=${payload.to}`);
  }

  /**
   * Um único cliente Twilio pra SMS e WhatsApp — as duas são a mesma conta/credenciais,
   * só mudam o remetente (`TWILIO_SMS_FROM` vs `TWILIO_WHATSAPP_FROM`) e o formato da
   * mensagem (texto livre vs template aprovado pela Meta). Cada canal liga de forma
   * independente: dá pra configurar só SMS agora e WhatsApp depois, sem mexer em código.
   * Sem `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`, os dois ficam desligados (mesmo padrão
   * defensivo do email sem MAIL_PASS) — nada quebra, só não envia até configurar de
   * verdade. Ver PLANO_INTEGRACAO_SMS_CODIGO.md / PLANO_INTEGRACAO_WHATSAPP_CODIGO.md.
   */
  private setupTwilio() {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID', '');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN', '');

    if (!accountSid || !authToken) {
      this.logger.warn('TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not configured. SMS and WhatsApp sending disabled.');
      return;
    }

    this.twilioClient = Twilio(accountSid, authToken);

    const smsFrom = this.configService.get<string>('TWILIO_SMS_FROM', '');
    if (smsFrom) {
      this.smsFrom = smsFrom;
    } else {
      this.logger.warn('TWILIO_SMS_FROM not configured. SMS sending disabled.');
    }

    const whatsappFrom = this.configService.get<string>('TWILIO_WHATSAPP_FROM', '');
    if (whatsappFrom) {
      this.whatsappFrom = whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`;
    } else {
      this.logger.warn('TWILIO_WHATSAPP_FROM not configured. WhatsApp sending disabled.');
    }
  }

  private async handleSmsJob(payload: SmsJobPayload): Promise<void> {
    if (!this.twilioClient || !this.smsFrom) {
      this.logger.warn(`SMS sending not configured. Skipping message to ${payload.to}.`);
      return;
    }

    await this.twilioClient.messages.create({
      from: this.smsFrom,
      to: payload.to,
      body: payload.body,
    });

    this.logger.log(`SMS sent to=${payload.to}`);
  }

  private async handleWhatsAppJob(payload: WhatsAppJobPayload): Promise<void> {
    if (!this.twilioClient || !this.whatsappFrom) {
      this.logger.warn(`WhatsApp sending not configured. Skipping message to ${payload.to}.`);
      return;
    }

    const to = payload.to.startsWith('whatsapp:') ? payload.to : `whatsapp:${payload.to}`;

    await this.twilioClient.messages.create({
      from: this.whatsappFrom,
      to,
      contentSid: payload.contentSid,
      contentVariables: JSON.stringify(payload.contentVariables),
    });

    this.logger.log(`WhatsApp message sent: contentSid=${payload.contentSid} to=${payload.to}`);
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
