import { Controller, Get, Param, Query, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { ReceiptService } from './receipt.service';

@Public()
@Controller('orders')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Get(':id/receipt')
  async downloadReceipt(
    @Param('id') orderId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!token || !this.receiptService.verifyToken(orderId, token)) {
      throw new BadRequestException('Link inválido ou expirado');
    }

    const { pdf, orderNumber } = await this.receiptService.generatePdf(orderId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recibo-${orderNumber}.pdf"`,
      'Content-Length': pdf.length,
    });

    res.end(pdf);
  }
}
