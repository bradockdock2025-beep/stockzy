import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrdersService } from '../orders/orders.service';

/**
 * P1.1 do PLANO_IMPLEMENTACAO_AJUSTES_BACKEND_GESTAO.md — KPIs de gestão alcançáveis
 * pelo JWT normal de staff (o `getSalesSummary()` já existia, mas só era exposto via
 * admin/reports com API key separada, não pelo login do app de gestão).
 */
@Injectable()
export class DashboardService {
  private static readonly LOW_STOCK_THRESHOLD = 5;
  private static readonly LOW_STOCK_SAMPLE_SIZE = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  async getSummary() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [sales, lowStock, newCustomers7d, newNewsletterSubscribers7d] = await Promise.all([
      this.ordersService.getSalesSummary(),
      this.getLowStock(),
      this.prisma.customer.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.newsletterSubscription.count({ where: { subscribedAt: { gte: sevenDaysAgo } } }),
    ]);

    return {
      sales,
      pendingOrders: sales.byStatus.pending ?? 0,
      lowStock,
      newCustomers7d,
      newNewsletterSubscribers7d,
    };
  }

  private async getLowStock() {
    const threshold = DashboardService.LOW_STOCK_THRESHOLD;

    // PENDENCIAS-BACKEND-GESTAO-RONDA-2.md #2.2 — filtrar por stockQuantity bruto antes de
    // calcular o disponível (stock - reserved) escondia variantes de alto volume/alta
    // reserva quase esgotadas (ex.: stock 100, reserved 97 → available 3, mas stockQuantity
    // 100 já passava do corte e nunca chegava a ser considerada). Calcula
    // `stock_quantity - reserved_quantity` direto no banco, sem pré-filtro em cima da
    // coluna bruta.
    const rows = await this.prisma.$queryRaw<
      Array<{
        variant_id: string;
        sku: string;
        product_id: string;
        product_name: string;
        product_slug: string;
        available: number;
      }>
    >`
      SELECT
        i.variant_id, pv.sku, p.id AS product_id, p.name AS product_name, p.slug AS product_slug,
        (i.stock_quantity - i.reserved_quantity) AS available
      FROM inventory i
      JOIN product_variants pv ON pv.id = i.variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE pv.is_active = true
        AND (i.stock_quantity - i.reserved_quantity) <= ${threshold}
      ORDER BY available ASC
      LIMIT ${DashboardService.LOW_STOCK_SAMPLE_SIZE};
    `;

    const count = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM inventory i
      JOIN product_variants pv ON pv.id = i.variant_id
      WHERE pv.is_active = true
        AND (i.stock_quantity - i.reserved_quantity) <= ${threshold};
    `;

    return {
      threshold,
      count: Number(count[0]?.count ?? 0),
      items: rows.map((row) => ({
        variantId: row.variant_id,
        sku: row.sku,
        productId: row.product_id,
        productName: row.product_name,
        productSlug: row.product_slug,
        available: row.available,
      })),
    };
  }
}
