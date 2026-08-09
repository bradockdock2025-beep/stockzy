import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReceiptService {
  private readonly secret: string;
  private readonly apiUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.secret = this.configService.get<string>('PAYMENT_CONFIRMATION_SECRET') ?? 'fallback-secret';
    this.apiUrl = this.configService.get<string>('API_URL') ?? 'http://localhost:3000';
  }

  generateToken(orderId: string): string {
    return createHmac('sha256', this.secret).update(orderId).digest('hex');
  }

  verifyToken(orderId: string, token: string): boolean {
    const expected = this.generateToken(orderId);
    try {
      const a = Buffer.from(token);
      const b = Buffer.from(expected);
      const len = Math.max(a.length, b.length);
      const aPadded = Buffer.alloc(len);
      const bPadded = Buffer.alloc(len);
      a.copy(aPadded);
      b.copy(bPadded);
      return timingSafeEqual(aPadded, bPadded) && a.length === b.length;
    } catch {
      return false;
    }
  }

  receiptUrl(orderId: string): string {
    const token = this.generateToken(orderId);
    return `${this.apiUrl}/orders/${orderId}/receipt?token=${token}`;
  }

  async generatePdf(orderId: string): Promise<{ pdf: Buffer; orderNumber: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, phoneNumber: true } },
        payment: { select: { method: true } },
        items: {
          include: {
            variant: {
              include: {
                facetValues: { include: { facetValue: { include: { facet: true } } } },
              },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    const labels: Record<string, Record<string, string>> = {
      pt: { title: 'Recibo de Compra', order: 'PEDIDO', date: 'DATA', status: 'ESTADO', paid: 'Pago', payment: 'PAGAMENTO', customer: 'CLIENTE', address: 'ENDEREÇO DE ENTREGA', product: 'PRODUTO', qty: 'QTD', price: 'VALOR', subtotal: 'Subtotal', shipping: 'Frete', total: 'Total', estimatedShipping: 'DISPONÍVEL A PARTIR DE', footer: 'Stockzy · support@stockzy.com' },
      fr: { title: "Reçu d'Achat", order: 'COMMANDE', date: 'DATE', status: 'ÉTAT', paid: 'Payé', payment: 'PAIEMENT', customer: 'CLIENT', address: 'ADRESSE DE LIVRAISON', product: 'PRODUIT', qty: 'QTÉ', price: 'PRIX', subtotal: 'Sous-total', shipping: 'Livraison', total: 'Total', estimatedShipping: 'DISPONIBLE À PARTIR DE', footer: 'Stockzy · support@stockzy.com' },
      en: { title: 'Purchase Receipt', order: 'ORDER', date: 'DATE', status: 'STATUS', paid: 'Paid', payment: 'PAYMENT', customer: 'CUSTOMER', address: 'SHIPPING ADDRESS', product: 'PRODUCT', qty: 'QTY', price: 'PRICE', subtotal: 'Subtotal', shipping: 'Shipping', total: 'Total', estimatedShipping: 'AVAILABLE FROM', footer: 'Stockzy · support@stockzy.com' },
      es: { title: 'Recibo de Compra', order: 'PEDIDO', date: 'FECHA', status: 'ESTADO', paid: 'Pagado', payment: 'PAGO', customer: 'CLIENTE', address: 'DIRECCIÓN DE ENVÍO', product: 'PRODUCTO', qty: 'CANT', price: 'PRECIO', subtotal: 'Subtotal', shipping: 'Envío', total: 'Total', estimatedShipping: 'DISPONIBLE A PARTIR DE', footer: 'Stockzy · support@stockzy.com' },
    };
    const t = labels[order.locale ?? 'pt'] ?? labels['pt'];

    const expectedAvailableAt = order.items[0]?.variant?.expectedAvailableAt as Date | undefined | null;
    const expectedDateStr = expectedAvailableAt
      ? `${String(expectedAvailableAt.getMonth() + 1).padStart(2, '0')}/${expectedAvailableAt.getFullYear()}`
      : null;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve({ pdf: Buffer.concat(chunks), orderNumber: order.orderNumber }));
      doc.on('error', reject);

      const black = '#000000';
      const gray = '#666666';
      const lightGray = '#f5f5f5';

      // Header
      const headerH = 90;
      doc.rect(0, 0, doc.page.width, headerH).fill(black);
      const logoPath = join(process.cwd(), 'src/assets/logofontWhite.png');
      const logoH = 65;
      const logoW = logoH * (1536 / 1024);
      doc.image(logoPath, (doc.page.width - logoW) / 2, (headerH - logoH) / 2, { height: logoH });

      // Title
      doc.fillColor(black).fontSize(18).font('Helvetica-Bold')
        .text(t.title, 50, 108);

      // Order info box: pedido | data | estado | pagamento [| envio previsto]
      const infoBoxH = expectedDateStr ? 148 : 110;
      doc.rect(50, 130, doc.page.width - 100, infoBoxH).fill(lightGray);

      doc.fillColor(gray).fontSize(10).font('Helvetica')
        .text(t.order, 70, 145);
      doc.fillColor(black).fontSize(11).font('Helvetica-Bold')
        .text(order.orderNumber, 70, 159, { width: doc.page.width - 160 });

      doc.moveTo(70, 181).lineTo(doc.page.width - 70, 181).strokeColor('#dddddd').stroke();

      const paymentMethod = order.payment?.method ?? '';
      doc.fillColor(gray).fontSize(10).font('Helvetica')
        .text(t.date, 70, 192)
        .text(t.status, 240, 192)
        .text(t.payment, 410, 192);
      doc.fillColor(black).fontSize(11).font('Helvetica-Bold')
        .text(order.createdAt.toLocaleDateString('pt-PT'), 70, 207)
        .text(t.paid, 240, 207)
        .text(paymentMethod, 410, 207, { width: 120 });

      if (expectedDateStr) {
        doc.moveTo(70, 225).lineTo(doc.page.width - 70, 225).strokeColor('#dddddd').stroke();
        doc.fillColor(gray).fontSize(10).font('Helvetica')
          .text(t.estimatedShipping, 70, 234);
        doc.fillColor(black).fontSize(11).font('Helvetica-Bold')
          .text(expectedDateStr, 70, 248, { width: doc.page.width - 160 });
      }

      // Customer + phone
      const detailsTop = 130 + infoBoxH + 18;
      const addr = order.shippingAddress as Record<string, string> | null;
      const customerName = order.customer
        ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim() || 'Cliente'
        : addr?.name || 'Cliente';
      const phone = order.customer?.phoneNumber ?? order.guestPhone ?? '';
      doc.fillColor(gray).fontSize(10).font('Helvetica')
        .text(t.customer, 50, detailsTop);
      doc.fillColor(black).fontSize(11).font('Helvetica')
        .text(customerName, 50, detailsTop + 15)
        .text(order.customer?.email ?? addr?.email ?? '', 50, detailsTop + 30);
      if (phone) {
        doc.text(phone, 50, detailsTop + 45);
      }

      // Shipping address
      let tableTop = detailsTop + (phone ? 86 : 71);
      if (addr?.street) {
        doc.fillColor(gray).fontSize(10).font('Helvetica')
          .text(t.address, 300, detailsTop);
        const addrLine2 = [addr.city, addr.state].filter(Boolean).join(', ') + (addr.zipcode ? ` — ${addr.zipcode}` : '');
        doc.fillColor(black).fontSize(11).font('Helvetica')
          .text(addr.street, 300, detailsTop + 15)
          .text(addrLine2, 300, detailsTop + 30)
          .text(addr.country ?? '', 300, detailsTop + 45);
      }
      doc.rect(50, tableTop, doc.page.width - 100, 24).fill(black);
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
        .text(t.product, 60, tableTop + 7)
        .text(t.qty, 350, tableTop + 7, { width: 50, align: 'center' })
        .text(t.price, 430, tableTop + 7, { width: 80, align: 'right' });

      // Items rows
      let y = tableTop + 34;

      for (const item of order.items) {
        if (y > 680) break;
        const attrs = item.variant?.facetValues
          ?.filter((fv) => fv.facetValue.facet.key !== 'gender')
          ?.map((fv) => `${fv.facetValue.facet.name}: ${fv.facetValue.label}`)
          .join(' · ') ?? '';
        const subLine = attrs;

        doc.fillColor(black).font('Helvetica').fontSize(11)
          .text(item.productName, 60, y, { width: 280 })
          .text(String(item.quantity), 350, y, { width: 50, align: 'center' })
          .text(`€ ${Number(item.totalPrice).toFixed(2)}`, 430, y, { width: 80, align: 'right' });

        const rowH = subLine ? 32 : 24;
        if (subLine) {
          doc.fillColor(gray).fontSize(9).font('Helvetica')
            .text(subLine, 60, y + 14, { width: 310 });
        }

        doc.moveTo(50, y + rowH).lineTo(doc.page.width - 50, y + rowH)
          .strokeColor('#eeeeee').stroke();

        y += rowH + 6;
      }

      // Totals
      y += 14;
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor('#cccccc').stroke();
      y += 14;

      doc.fillColor(gray).fontSize(11)
        .text(t.subtotal, 350, y)
        .text(`€ ${Number(order.subtotal).toFixed(2)}`, 430, y, { width: 80, align: 'right' });
      y += 22;

      doc.text(t.shipping, 350, y)
        .text(`€ ${Number(order.shippingAmount).toFixed(2)}`, 430, y, { width: 80, align: 'right' });
      y += 22;

      doc.fillColor(black).fontSize(13).font('Helvetica-Bold')
        .text(t.total, 350, y)
        .text(`€ ${Number(order.totalAmount).toFixed(2)}`, 430, y, { width: 80, align: 'right' });

      // Footer
      doc.fillColor(gray).fontSize(9).font('Helvetica')
        .text(t.footer, 50, doc.page.height - 50, {
          align: 'center',
          width: doc.page.width - 100,
        });

      doc.end();
    });
  }
}
