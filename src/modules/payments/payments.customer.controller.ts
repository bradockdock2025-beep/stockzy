import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CustomerAuthGuard } from '../customers/customer-auth.guard';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { PaymentsService } from './payments.service';
import { buildAuditContext } from '../../common/audit/audit-context';

@Public()
@Controller('customers/orders')
@UseGuards(CustomerAuthGuard)
export class PaymentsCustomerController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':id/payment')
  createPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { customerAuth?: { authUserId?: string }; user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-idempotency-key') fallbackIdempotencyKey: string | undefined,
    @Headers('x-payment-method') paymentMethodHeader: string | undefined,
  ) {
    const paymentMethod =
      paymentMethodHeader?.toLowerCase() === 'stripe' ? 'stripe' : 'cod';
    return this.paymentsService.createForCustomerOrder({
      orderId: id,
      authUserId: req.customerAuth?.authUserId ?? '',
      context: buildAuditContext(req),
      idempotencyKey: idempotencyKey ?? fallbackIdempotencyKey,
      paymentMethod,
    });
  }

  @Post(':id/payment/confirm')
  confirm(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ConfirmPaymentDto,
    @Req() req: { customerAuth?: { authUserId?: string }; user?: unknown; headers?: Record<string, unknown>; ip?: string },
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-idempotency-key') fallbackIdempotencyKey: string | undefined,
  ) {
    return this.paymentsService.confirmPayment({
      orderId: id,
      code: dto.code,
      authUserId: req.customerAuth?.authUserId ?? '',
      context: buildAuditContext(req),
      idempotencyKey: idempotencyKey ?? fallbackIdempotencyKey,
    });
  }
}
