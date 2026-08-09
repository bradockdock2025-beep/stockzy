import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomersService } from './customers.service';
import { Public } from '../../common/decorators/public.decorator';

type AuthWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
  user?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
};

@Controller('webhooks/supabase')
export class CustomersWebhookController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly configService: ConfigService,
  ) {}

  @Post('auth')
  @Public()
  async handleAuthWebhook(
    @Body() payload: AuthWebhookPayload,
    @Headers('x-webhook-secret') secret: string | undefined,
    @Headers('x-supabase-webhook-secret') supabaseSecret: string | undefined,
  ) {
    const expected = this.configService.get<string>('SUPABASE_WEBHOOK_SECRET');
    const provided = secret ?? supabaseSecret;
    if (expected && (!provided || provided !== expected)) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    return this.customersService.upsertFromAuthWebhook(payload);
  }
}
