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

    // Prisma não filtra por diferença entre duas colunas direto — traz ativos com
    // stockQuantity baixo (o teto que realmente importa pra escassez) e refina em JS
    // pela quantidade disponível de verdade (stock - reserved).
    const candidates = await this.prisma.inventory.findMany({
      where: {
        stockQuantity: { lte: threshold + 20 },
        variant: { isActive: true },
      },
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            product: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    const lowStockItems = candidates
      .map((inv) => ({
        variantId: inv.variant.id,
        sku: inv.variant.sku,
        productId: inv.variant.product.id,
        productName: inv.variant.product.name,
        productSlug: inv.variant.product.slug,
        available: inv.stockQuantity - inv.reservedQuantity,
      }))
      .filter((item) => item.available <= threshold)
      .sort((a, b) => a.available - b.available);

    return {
      threshold,
      count: lowStockItems.length,
      items: lowStockItems.slice(0, DashboardService.LOW_STOCK_SAMPLE_SIZE),
    };
  }
}
