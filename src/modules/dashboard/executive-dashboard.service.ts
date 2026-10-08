import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, order_status } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { VALID_ORDER_STATUSES } from '../../common/orders/valid-order-statuses';
import { QueryExecutiveDashboardDto } from './dto/query-executive-dashboard.dto';

const CACHE_TTL_SECONDS = 300;

@Injectable()
export class ExecutiveDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getExecutive(query: QueryExecutiveDashboardDto) {
    const { from, to, granularity, tz } = this.normalizeQuery(query);

    const cacheKey = `cache:dashboard:executive:${from}:${to}:${granularity}:${tz}`;
    if (this.redisService.isReady()) {
      try {
        const cached = await this.redisService.getJson<unknown>(cacheKey);
        if (cached) {
          return cached;
        }
      } catch {
        // cache é best-effort
      }
    }

    const toExclusive = this.addDays(to, 1);
    const daysInRange = this.daysBetweenInclusive(from, to);
    const previousTo = this.addDays(from, -1);
    const previousFrom = this.addDays(previousTo, -(daysInRange - 1));
    const previousToExclusive = this.addDays(previousTo, 1);

    const [
      kpisCurrent,
      kpisPrevious,
      timeseriesCurrent,
      timeseriesPrevious,
      statusBreakdown,
      fulfillment,
      topProducts,
      byCategory,
      byBrand,
      paymentMethods,
      customers,
      heatmap,
      geography,
      promotions,
      offers,
      inventory,
    ] = await Promise.all([
      this.getKpis(from, toExclusive, tz),
      this.getKpis(previousFrom, previousToExclusive, tz),
      this.getTimeseries(from, to, toExclusive, granularity, tz),
      this.getTimeseries(previousFrom, previousTo, previousToExclusive, granularity, tz),
      this.getStatusBreakdown(from, toExclusive, tz),
      this.getFulfillment(from, toExclusive, tz),
      this.getTopProducts(from, toExclusive, tz),
      this.getByCategory(from, toExclusive, tz),
      this.getByBrand(from, toExclusive, tz),
      this.getPaymentMethods(from, toExclusive, tz),
      this.getCustomersSection(from, toExclusive, tz),
      this.getHeatmap(from, toExclusive, tz),
      this.getGeography(from, toExclusive, tz),
      this.getPromotions(from, toExclusive, tz),
      this.getOffers(from, toExclusive, tz),
      this.getInventory(),
    ]);

    const timeseries = timeseriesCurrent.map((point, index) => ({
      ...point,
      previousRevenue: timeseriesPrevious[index]?.revenue ?? null,
      previousOrders: timeseriesPrevious[index]?.orders ?? null,
    }));

    const result = {
      period: {
        from,
        to,
        granularity,
        tz,
        previousFrom,
        previousTo,
        currency: 'EUR',
        generatedAt: new Date().toISOString(),
      },
      kpis: {
        revenue: { current: kpisCurrent.revenue, previous: kpisPrevious.revenue },
        pendingRevenue: { current: kpisCurrent.pendingRevenue, previous: kpisPrevious.pendingRevenue },
        orders: { current: kpisCurrent.orders, previous: kpisPrevious.orders },
        averageOrderValue: { current: kpisCurrent.averageOrderValue, previous: kpisPrevious.averageOrderValue },
        unitsSold: { current: kpisCurrent.unitsSold, previous: kpisPrevious.unitsSold },
        newCustomers: { current: kpisCurrent.newCustomers, previous: kpisPrevious.newCustomers },
        repeatCustomerRate: { current: kpisCurrent.repeatCustomerRate, previous: kpisPrevious.repeatCustomerRate },
        cancellationRate: { current: kpisCurrent.cancellationRate, previous: kpisPrevious.cancellationRate },
        refundRate: { current: kpisCurrent.refundRate, previous: kpisPrevious.refundRate },
        discountTotal: { current: kpisCurrent.discountTotal, previous: kpisPrevious.discountTotal },
      },
      timeseries,
      statusBreakdown,
      fulfillment,
      topProducts,
      byCategory,
      byBrand,
      paymentMethods,
      customers,
      heatmap,
      geography,
      promotions,
      offers,
      inventory,
    };

    if (this.redisService.isReady()) {
      try {
        await this.redisService.setJson(cacheKey, result, CACHE_TTL_SECONDS);
      } catch {
        // cache é best-effort
      }
    }

    return result;
  }

  // ── Datas ─────────────────────────────────────────────────────────────────

  private normalizeQuery(query: QueryExecutiveDashboardDto) {
    const { from, to } = query;
    const granularity = query.granularity ?? 'day';
    const tz = query.tz?.trim() || 'Europe/Lisbon';

    const fromDate = new Date(`${from}T00:00:00Z`);
    const toDate = new Date(`${to}T00:00:00Z`);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('from and to must be valid dates');
    }
    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('from must not be after to');
    }

    const daysInRange = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    if (daysInRange > 366) {
      throw new BadRequestException('Date range cannot exceed 366 days');
    }

    return { from, to, granularity, tz };
  }

  private addDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  }

  private daysBetweenInclusive(fromStr: string, toStr: string): number {
    const [fy, fm, fd] = fromStr.split('-').map(Number);
    const [ty, tm, td] = toStr.split('-').map(Number);
    return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000) + 1;
  }

  // ── Helpers numéricos ────────────────────────────────────────────────────

  private num(value: unknown): number {
    if (value === null || value === undefined) return 0;
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  private int(value: unknown): number {
    if (value === null || value === undefined) return 0;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }

  private ratio(numerator: number, denominator: number): number {
    if (!denominator) return 0;
    return Math.round((numerator / denominator) * 10000) / 10000;
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────

  private async getCustomerCohort(from: string, toExclusive: string, tz: string) {
    const rows = await this.prisma.$queryRaw<Array<{ new_customers: bigint; recurring_customers: bigint }>>(
      Prisma.sql`
        WITH customer_first_valid AS (
          SELECT customer_id, MIN(created_at) AS first_valid_at
          FROM orders
          WHERE customer_id IS NOT NULL AND status IN (${Prisma.join(VALID_ORDER_STATUSES)})
          GROUP BY customer_id
        ),
        period_customers AS (
          SELECT DISTINCT customer_id
          FROM orders
          WHERE customer_id IS NOT NULL
            AND status IN (${Prisma.join(VALID_ORDER_STATUSES)})
            AND created_at >= (${from}::date AT TIME ZONE ${tz})
            AND created_at < (${toExclusive}::date AT TIME ZONE ${tz})
        )
        SELECT
          COUNT(*) FILTER (
            WHERE cfv.first_valid_at >= (${from}::date AT TIME ZONE ${tz})
              AND cfv.first_valid_at < (${toExclusive}::date AT TIME ZONE ${tz})
          ) AS new_customers,
          COUNT(*) FILTER (
            WHERE cfv.first_valid_at < (${from}::date AT TIME ZONE ${tz})
          ) AS recurring_customers
        FROM period_customers pc
        JOIN customer_first_valid cfv ON cfv.customer_id = pc.customer_id
      `,
    );
    const row = rows[0];
    return {
      newCustomers: this.int(row?.new_customers ?? 0),
      recurringCustomers: this.int(row?.recurring_customers ?? 0),
    };
  }

  private async getKpis(from: string, toExclusive: string, tz: string) {
    const [mainRows, unitsRows, cohort] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          valid_orders: bigint;
          revenue: Prisma.Decimal;
          pending_revenue: Prisma.Decimal;
          discount_total: Prisma.Decimal;
          cancelled_count: bigint;
          refunded_count: bigint;
          total_created: bigint;
        }>
      >(
        Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE status IN (${Prisma.join(VALID_ORDER_STATUSES)})) AS valid_orders,
            COALESCE(SUM(total_amount) FILTER (WHERE status IN (${Prisma.join(VALID_ORDER_STATUSES)})), 0) AS revenue,
            COALESCE(SUM(total_amount) FILTER (WHERE status = 'pending'), 0) AS pending_revenue,
            COALESCE(SUM(discount_amount) FILTER (WHERE status IN (${Prisma.join(VALID_ORDER_STATUSES)})), 0) AS discount_total,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
            COUNT(*) FILTER (WHERE status = 'refunded') AS refunded_count,
            COUNT(*) AS total_created
          FROM orders
          WHERE created_at >= (${from}::date AT TIME ZONE ${tz})
            AND created_at < (${toExclusive}::date AT TIME ZONE ${tz})
        `,
      ),
      this.prisma.$queryRaw<Array<{ units: bigint }>>(
        Prisma.sql`
          SELECT COALESCE(SUM(oi.quantity), 0) AS units
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.status IN (${Prisma.join(VALID_ORDER_STATUSES)})
            AND o.created_at >= (${from}::date AT TIME ZONE ${tz})
            AND o.created_at < (${toExclusive}::date AT TIME ZONE ${tz})
        `,
      ),
      this.getCustomerCohort(from, toExclusive, tz),
    ]);

    const main = mainRows[0];
    const validOrders = this.int(main?.valid_orders ?? 0);
    const revenue = this.num(main?.revenue ?? 0);
    const cancelledCount = this.int(main?.cancelled_count ?? 0);
    const refundedCount = this.int(main?.refunded_count ?? 0);
    const totalCreated = this.int(main?.total_created ?? 0);

    return {
      revenue,
      pendingRevenue: this.num(main?.pending_revenue ?? 0),
      orders: validOrders,
      averageOrderValue: validOrders > 0 ? this.num(revenue / validOrders) : 0,
      unitsSold: this.int(unitsRows[0]?.units ?? 0),
      newCustomers: cohort.newCustomers,
      repeatCustomerRate: this.ratio(cohort.recurringCustomers, cohort.newCustomers + cohort.recurringCustomers),
      cancellationRate: this.ratio(cancelledCount, totalCreated),
      refundRate: this.ratio(refundedCount, validOrders + refundedCount),
      discountTotal: this.num(main?.discount_total ?? 0),
    };
  }

  // ── Timeseries ────────────────────────────────────────────────────────────

  private async getTimeseries(
    from: string,
    to: string,
    toExclusive: string,
    granularity: 'day' | 'week' | 'month',
    tz: string,
  ) {
    const intervalStr = `1 ${granularity}`;

    const rows = await this.prisma.$queryRaw<
      Array<{ bucket: Date; orders: bigint; revenue: Prisma.Decimal; units: bigint; new_customers: bigint }>
    >(
      Prisma.sql`
        WITH buckets AS (
          SELECT generate_series(
            date_trunc(${granularity}, ${from}::date::timestamp),
            date_trunc(${granularity}, ${to}::date::timestamp),
            (${intervalStr})::interval
          ) AS bucket
        ),
        agg AS (
          SELECT
            date_trunc(${granularity}, created_at AT TIME ZONE ${tz}) AS bucket,
            COUNT(*) FILTER (WHERE status IN (${Prisma.join(VALID_ORDER_STATUSES)})) AS orders,
            COALESCE(SUM(total_amount) FILTER (WHERE status IN (${Prisma.join(VALID_ORDER_STATUSES)})), 0) AS revenue
          FROM orders
          WHERE created_at >= (${from}::date AT TIME ZONE ${tz})
            AND created_at < (${toExclusive}::date AT TIME ZONE ${tz})
          GROUP BY 1
        ),
        units_agg AS (
          SELECT
            date_trunc(${granularity}, o.created_at AT TIME ZONE ${tz}) AS bucket,
            COALESCE(SUM(oi.quantity), 0) AS units
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.status IN (${Prisma.join(VALID_ORDER_STATUSES)})
            AND o.created_at >= (${from}::date AT TIME ZONE ${tz})
            AND o.created_at < (${toExclusive}::date AT TIME ZONE ${tz})
          GROUP BY 1
        ),
        new_cust_agg AS (
          SELECT
            date_trunc(${granularity}, first_valid_at AT TIME ZONE ${tz}) AS bucket,
            COUNT(*) AS new_customers
          FROM (
            SELECT customer_id, MIN(created_at) AS first_valid_at
            FROM orders
            WHERE customer_id IS NOT NULL AND status IN (${Prisma.join(VALID_ORDER_STATUSES)})
            GROUP BY customer_id
          ) cfv
          WHERE first_valid_at >= (${from}::date AT TIME ZONE ${tz})
            AND first_valid_at < (${toExclusive}::date AT TIME ZONE ${tz})
          GROUP BY 1
        )
        SELECT
          b.bucket,
          COALESCE(a.orders, 0) AS orders,
          COALESCE(a.revenue, 0) AS revenue,
          COALESCE(u.units, 0) AS units,
          COALESCE(n.new_customers, 0) AS new_customers
        FROM buckets b
        LEFT JOIN agg a ON a.bucket = b.bucket
        LEFT JOIN units_agg u ON u.bucket = b.bucket
        LEFT JOIN new_cust_agg n ON n.bucket = b.bucket
        ORDER BY b.bucket
      `,
    );

    return rows.map((row) => ({
      date: row.bucket.toISOString().slice(0, 10),
      revenue: this.num(row.revenue),
      orders: this.int(row.orders),
      units: this.int(row.units),
      newCustomers: this.int(row.new_customers),
    }));
  }

  // ── Status breakdown ──────────────────────────────────────────────────────

  private async getStatusBreakdown(from: string, toExclusive: string, tz: string) {
    const rows = await this.prisma.$queryRaw<Array<{ status: order_status; count: bigint }>>(
      Prisma.sql`
        SELECT status, COUNT(*) AS count
        FROM orders
        WHERE created_at >= (${from}::date AT TIME ZONE ${tz})
          AND created_at < (${toExclusive}::date AT TIME ZONE ${tz})
        GROUP BY status
      `,
    );

    const breakdown: Record<string, number> = {
      pending: 0,
      paid: 0,
      presale: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      refunded: 0,
    };
    for (const row of rows) {
      breakdown[row.status] = this.int(row.count);
    }
    return breakdown;
  }

  // ── Fulfillment ───────────────────────────────────────────────────────────

  private async getFulfillment(from: string, toExclusive: string, tz: string) {
    const [awaitingRows, avgPaidToShippedRows, avgShippedToDeliveredRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ awaiting: bigint; awaiting_over_48h: bigint }>>(
        Prisma.sql`
          SELECT
            COUNT(*) AS awaiting,
            COUNT(*) FILTER (
              WHERE COALESCE(p.confirmed_at, o.updated_at) < now() - interval '48 hours'
            ) AS awaiting_over_48h
          FROM orders o
          LEFT JOIN payments p ON p.order_id = o.id
          WHERE o.status IN ('paid', 'processing')
            AND NOT EXISTS (
              SELECT 1 FROM shipments s
              WHERE s.order_id = o.id AND s.status IN ('shipped', 'in_transit', 'delivered')
            )
        `,
      ),
      this.prisma.$queryRaw<Array<{ avg_hours: number | null }>>(
        Prisma.sql`
          SELECT AVG(EXTRACT(EPOCH FROM (s.shipped_at - p.confirmed_at)) / 3600.0) AS avg_hours
          FROM shipments s
          JOIN payments p ON p.order_id = s.order_id
          WHERE s.shipped_at IS NOT NULL AND p.confirmed_at IS NOT NULL
            AND s.shipped_at >= (${from}::date AT TIME ZONE ${tz})
            AND s.shipped_at < (${toExclusive}::date AT TIME ZONE ${tz})
        `,
      ),
      this.prisma.$queryRaw<Array<{ avg_hours: number | null }>>(
        Prisma.sql`
          SELECT AVG(EXTRACT(EPOCH FROM (s.delivered_at - s.shipped_at)) / 3600.0) AS avg_hours
          FROM shipments s
          WHERE s.delivered_at IS NOT NULL AND s.shipped_at IS NOT NULL
            AND s.delivered_at >= (${from}::date AT TIME ZONE ${tz})
            AND s.delivered_at < (${toExclusive}::date AT TIME ZONE ${tz})
        `,
      ),
    ]);

    const awaiting = awaitingRows[0];
    const avgPaidToShipped = avgPaidToShippedRows[0]?.avg_hours;
    const avgShippedToDelivered = avgShippedToDeliveredRows[0]?.avg_hours;

    return {
      awaitingShipment: this.int(awaiting?.awaiting ?? 0),
      awaitingShipmentOver48h: this.int(awaiting?.awaiting_over_48h ?? 0),
      avgHoursPaidToShipped: avgPaidToShipped === null || avgPaidToShipped === undefined ? null : this.num(avgPaidToShipped),
      avgHoursShippedToDelivered:
        avgShippedToDelivered === null || avgShippedToDelivered === undefined ? null : this.num(avgShippedToDelivered),
    };
  }

  // ── Top produtos ──────────────────────────────────────────────────────────

  private async getTopProducts(from: string, toExclusive: string, tz: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        product_id: string;
        name: string;
        brand_name: string | null;
        category_name: string;
        units: bigint;
        revenue: Prisma.Decimal;
      }>
    >(
      Prisma.sql`
        SELECT
          p.id AS product_id, p.name, b.name AS brand_name, c.name AS category_name,
          SUM(oi.quantity) AS units, SUM(oi.total_price) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN products p ON p.id = pv.product_id
        LEFT JOIN brands b ON b.id = p.brand_id
        JOIN categories c ON c.id = p.category_id
        WHERE o.status IN (${Prisma.join(VALID_ORDER_STATUSES)})
          AND o.created_at >= (${from}::date AT TIME ZONE ${tz})
          AND o.created_at < (${toExclusive}::date AT TIME ZONE ${tz})
        GROUP BY p.id, p.name, b.name, c.name
        ORDER BY revenue DESC
        LIMIT 10
      `,
    );

    if (rows.length === 0) {
      return [];
    }

    const productIds = rows.map((r) => r.product_id);

    const [availableRows, rankings] = await Promise.all([
      this.prisma.$queryRaw<Array<{ product_id: string; available: bigint }>>(
        Prisma.sql`
          SELECT pv.product_id, SUM(GREATEST(inv.stock_quantity - inv.reserved_quantity, 0)) AS available
          FROM product_variants pv
          JOIN inventory inv ON inv.variant_id = pv.id
          WHERE pv.is_active = true AND pv.product_id IN (${Prisma.join(productIds)})
          GROUP BY pv.product_id
        `,
      ),
      this.prisma.productRanking.findMany({
        where: { productId: { in: productIds } },
        select: { productId: true, unitsSold30d: true },
      }),
    ]);

    const availableByProduct = new Map(availableRows.map((r) => [r.product_id, this.int(r.available)]));
    const rankingByProduct = new Map(rankings.map((r) => [r.productId, r.unitsSold30d]));

    return rows.map((row) => {
      const available = availableByProduct.get(row.product_id) ?? 0;
      const unitsSold30d = rankingByProduct.get(row.product_id) ?? 0;
      return {
        productId: row.product_id,
        name: row.name,
        brand: row.brand_name,
        category: row.category_name,
        units: this.int(row.units),
        revenue: this.num(row.revenue),
        available,
        daysOfCover: unitsSold30d > 0 ? this.num(available / (unitsSold30d / 30)) : null,
      };
    });
  }

  // ── Por categoria / marca ─────────────────────────────────────────────────

  private async getByCategory(from: string, toExclusive: string, tz: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{ category_id: string; name: string; units: bigint; revenue: Prisma.Decimal }>
    >(
      Prisma.sql`
        SELECT c.id AS category_id, c.name, SUM(oi.quantity) AS units, SUM(oi.total_price) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE o.status IN (${Prisma.join(VALID_ORDER_STATUSES)})
          AND o.created_at >= (${from}::date AT TIME ZONE ${tz})
          AND o.created_at < (${toExclusive}::date AT TIME ZONE ${tz})
        GROUP BY c.id, c.name
        ORDER BY revenue DESC
      `,
    );

    const top = rows.slice(0, 8).map((row) => ({
      categoryId: row.category_id,
      name: row.name,
      revenue: this.num(row.revenue),
      units: this.int(row.units),
    }));

    const rest = rows.slice(8);
    if (rest.length > 0) {
      const revenue = rest.reduce((sum, row) => sum + Number(row.revenue), 0);
      const units = rest.reduce((sum, row) => sum + Number(row.units), 0);
      top.push({ categoryId: null as unknown as string, name: 'Outras', revenue: this.num(revenue), units: this.int(units) });
    }

    return top;
  }

  private async getByBrand(from: string, toExclusive: string, tz: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{ brand_id: string | null; name: string; units: bigint; revenue: Prisma.Decimal }>
    >(
      Prisma.sql`
        SELECT b.id AS brand_id, COALESCE(b.name, 'Sem marca') AS name,
          SUM(oi.quantity) AS units, SUM(oi.total_price) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN products p ON p.id = pv.product_id
        LEFT JOIN brands b ON b.id = p.brand_id
        WHERE o.status IN (${Prisma.join(VALID_ORDER_STATUSES)})
          AND o.created_at >= (${from}::date AT TIME ZONE ${tz})
          AND o.created_at < (${toExclusive}::date AT TIME ZONE ${tz})
        GROUP BY b.id, b.name
        ORDER BY revenue DESC
        LIMIT 10
      `,
    );

    return rows.map((row) => ({
      brandId: row.brand_id,
      name: row.name,
      revenue: this.num(row.revenue),
      units: this.int(row.units),
    }));
  }

  // ── Métodos de pagamento ──────────────────────────────────────────────────

  private async getPaymentMethods(from: string, toExclusive: string, tz: string) {
    const [revenueRows, failedRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ method: string; orders: bigint; revenue: Prisma.Decimal }>>(
        Prisma.sql`
          SELECT p.method, COUNT(*) AS orders, SUM(o.total_amount) AS revenue
          FROM payments p
          JOIN orders o ON o.id = p.order_id
          WHERE o.status IN (${Prisma.join(VALID_ORDER_STATUSES)})
            AND o.created_at >= (${from}::date AT TIME ZONE ${tz})
            AND o.created_at < (${toExclusive}::date AT TIME ZONE ${tz})
          GROUP BY p.method
        `,
      ),
      this.prisma.$queryRaw<Array<{ method: string; failed_or_expired: bigint }>>(
        Prisma.sql`
          SELECT p.method, COUNT(*) AS failed_or_expired
          FROM payments p
          JOIN orders o ON o.id = p.order_id
          WHERE p.status IN ('failed', 'expired')
            AND o.created_at >= (${from}::date AT TIME ZONE ${tz})
            AND o.created_at < (${toExclusive}::date AT TIME ZONE ${tz})
          GROUP BY p.method
        `,
      ),
    ]);

    const byMethod = new Map<string, { orders: number; revenue: number; failedOrExpired: number }>([
      ['cod', { orders: 0, revenue: 0, failedOrExpired: 0 }],
      ['stripe', { orders: 0, revenue: 0, failedOrExpired: 0 }],
    ]);

    for (const row of revenueRows) {
      const entry = byMethod.get(row.method) ?? { orders: 0, revenue: 0, failedOrExpired: 0 };
      entry.orders = this.int(row.orders);
      entry.revenue = this.num(row.revenue);
      byMethod.set(row.method, entry);
    }
    for (const row of failedRows) {
      const entry = byMethod.get(row.method) ?? { orders: 0, revenue: 0, failedOrExpired: 0 };
      entry.failedOrExpired = this.int(row.failed_or_expired);
      byMethod.set(row.method, entry);
    }

    return Array.from(byMethod.entries()).map(([method, data]) => ({ method, ...data }));
  }

  // ── Clientes ──────────────────────────────────────────────────────────────

  private async getCustomersSection(from: string, toExclusive: string, tz: string) {
    const [guestVsRegistered, cohort, topCustomers] = await Promise.all([
      this.prisma.$queryRaw<Array<{ guest_orders: bigint; registered_orders: bigint }>>(
        Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE customer_id IS NULL) AS guest_orders,
            COUNT(*) FILTER (WHERE customer_id IS NOT NULL) AS registered_orders
          FROM orders
          WHERE status IN (${Prisma.join(VALID_ORDER_STATUSES)})
            AND created_at >= (${from}::date AT TIME ZONE ${tz})
            AND created_at < (${toExclusive}::date AT TIME ZONE ${tz})
        `,
      ),
      this.getCustomerCohort(from, toExclusive, tz),
      this.prisma.$queryRaw<Array<{ customer_id: string; name: string | null; orders: bigint; revenue: Prisma.Decimal }>>(
        Prisma.sql`
          SELECT o.customer_id,
            COALESCE(NULLIF(TRIM(CONCAT(c.first_name, ' ', c.last_name)), ''), c.email) AS name,
            COUNT(*) AS orders, SUM(o.total_amount) AS revenue
          FROM orders o
          JOIN customers c ON c.id = o.customer_id
          WHERE o.status IN (${Prisma.join(VALID_ORDER_STATUSES)})
            AND o.customer_id IS NOT NULL
            AND o.created_at >= (${from}::date AT TIME ZONE ${tz})
            AND o.created_at < (${toExclusive}::date AT TIME ZONE ${tz})
          GROUP BY o.customer_id, c.first_name, c.last_name, c.email
          ORDER BY revenue DESC
          LIMIT 5
        `,
      ),
    ]);

    const row = guestVsRegistered[0];

    return {
      new: cohort.newCustomers,
      returning: cohort.recurringCustomers,
      guestOrders: this.int(row?.guest_orders ?? 0),
      registeredOrders: this.int(row?.registered_orders ?? 0),
      topCustomers: topCustomers.map((c) => ({
        customerId: c.customer_id,
        name: c.name,
        orders: this.int(c.orders),
        revenue: this.num(c.revenue),
      })),
    };
  }

  // ── Heatmap ───────────────────────────────────────────────────────────────

  private async getHeatmap(from: string, toExclusive: string, tz: string) {
    const rows = await this.prisma.$queryRaw<Array<{ weekday: number; hour: number; orders: bigint }>>(
      Prisma.sql`
        SELECT
          (EXTRACT(ISODOW FROM created_at AT TIME ZONE ${tz})::int - 1) AS weekday,
          EXTRACT(HOUR FROM created_at AT TIME ZONE ${tz})::int AS hour,
          COUNT(*) AS orders
        FROM orders
        WHERE status IN (${Prisma.join(VALID_ORDER_STATUSES)})
          AND created_at >= (${from}::date AT TIME ZONE ${tz})
          AND created_at < (${toExclusive}::date AT TIME ZONE ${tz})
        GROUP BY 1, 2
      `,
    );

    return rows.map((row) => ({ weekday: row.weekday, hour: row.hour, orders: this.int(row.orders) }));
  }

  // ── Geografia ─────────────────────────────────────────────────────────────

  private async getGeography(from: string, toExclusive: string, tz: string) {
    // Sem LIMIT — o painel monta um mapa-mundo por país com as cidades no hover, precisa
    // de todas as combinações. Agrupa por cidade normalizada (trim + minúsculas) pra não
    // separar "Lisboa" / "lisboa " / "LISBOA" como cidades diferentes; o rótulo exibido é
    // o primeiro valor (já aparado) encontrado nesse grupo.
    const rows = await this.prisma.$queryRaw<
      Array<{ country: string; city: string | null; orders: bigint; revenue: Prisma.Decimal }>
    >(
      Prisma.sql`
        SELECT country, MIN(city_raw) AS city, COUNT(*) AS orders, SUM(total_amount) AS revenue
        FROM (
          SELECT
            shipping_address->>'country' AS country,
            NULLIF(TRIM(shipping_address->>'city'), '') AS city_raw,
            LOWER(NULLIF(TRIM(shipping_address->>'city'), '')) AS city_key,
            total_amount
          FROM orders
          WHERE status IN (${Prisma.join(VALID_ORDER_STATUSES)})
            AND created_at >= (${from}::date AT TIME ZONE ${tz})
            AND created_at < (${toExclusive}::date AT TIME ZONE ${tz})
            AND shipping_address->>'country' IS NOT NULL
        ) sub
        GROUP BY country, city_key
        ORDER BY revenue DESC
      `,
    );

    return rows.map((row) => ({
      country: row.country,
      city: row.city,
      orders: this.int(row.orders),
      revenue: this.num(row.revenue),
    }));
  }

  // ── Promoções ─────────────────────────────────────────────────────────────

  private async getPromotions(from: string, toExclusive: string, tz: string) {
    const [summaryRows, topRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ orders_with_promotion: bigint; revenue_with_promotion: Prisma.Decimal; discount_total: Prisma.Decimal }>
      >(
        Prisma.sql`
          WITH promo_orders AS (
            SELECT DISTINCT o.id, o.total_amount, o.discount_amount
            FROM orders o
            JOIN promotion_usages pu ON pu.order_id = o.id
            WHERE o.status IN (${Prisma.join(VALID_ORDER_STATUSES)})
              AND o.created_at >= (${from}::date AT TIME ZONE ${tz})
              AND o.created_at < (${toExclusive}::date AT TIME ZONE ${tz})
          )
          SELECT
            COUNT(*) AS orders_with_promotion,
            COALESCE(SUM(total_amount), 0) AS revenue_with_promotion,
            COALESCE(SUM(discount_amount), 0) AS discount_total
          FROM promo_orders
        `,
      ),
      this.prisma.$queryRaw<
        Array<{
          promotion_id: string;
          name: string;
          code: string | null;
          uses: bigint;
          discount: Prisma.Decimal;
          revenue: Prisma.Decimal;
        }>
      >(
        Prisma.sql`
          SELECT pr.id AS promotion_id, pr.name, pr.code,
            COUNT(*) AS uses, COALESCE(SUM(o.discount_amount), 0) AS discount, COALESCE(SUM(o.total_amount), 0) AS revenue
          FROM promotion_usages pu
          JOIN orders o ON o.id = pu.order_id
          JOIN promotions pr ON pr.id = pu.promotion_id
          WHERE o.status IN (${Prisma.join(VALID_ORDER_STATUSES)})
            AND o.created_at >= (${from}::date AT TIME ZONE ${tz})
            AND o.created_at < (${toExclusive}::date AT TIME ZONE ${tz})
          GROUP BY pr.id, pr.name, pr.code
          ORDER BY discount DESC
          LIMIT 5
        `,
      ),
    ]);

    const summary = summaryRows[0];

    return {
      ordersWithPromotion: this.int(summary?.orders_with_promotion ?? 0),
      revenueWithPromotion: this.num(summary?.revenue_with_promotion ?? 0),
      discountTotal: this.num(summary?.discount_total ?? 0),
      top: topRows.map((row) => ({
        promotionId: row.promotion_id,
        name: row.name,
        code: row.code,
        uses: this.int(row.uses),
        discount: this.num(row.discount),
        revenue: this.num(row.revenue),
      })),
    };
  }

  // ── Ofertas ───────────────────────────────────────────────────────────────

  private async getOffers(from: string, toExclusive: string, tz: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{ received: bigint; accepted: bigint; rejected: bigint; expired: bigint; converted: bigint }>
    >(
      Prisma.sql`
        SELECT
          COUNT(*) AS received,
          COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
          COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
          COUNT(*) FILTER (WHERE status = 'expired') AS expired,
          COUNT(*) FILTER (WHERE status = 'converted') AS converted
        FROM offers
        WHERE created_at >= (${from}::date AT TIME ZONE ${tz})
          AND created_at < (${toExclusive}::date AT TIME ZONE ${tz})
      `,
    );

    const row = rows[0];
    return {
      received: this.int(row?.received ?? 0),
      accepted: this.int(row?.accepted ?? 0),
      rejected: this.int(row?.rejected ?? 0),
      expired: this.int(row?.expired ?? 0),
      converted: this.int(row?.converted ?? 0),
    };
  }

  // ── Stock ─────────────────────────────────────────────────────────────────

  private async getInventory() {
    const [summaryRows, atRiskRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ out_of_stock: bigint; low_stock: bigint; stock_value: Prisma.Decimal }>>(
        Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE (inv.stock_quantity - inv.reserved_quantity) <= 0) AS out_of_stock,
            COUNT(*) FILTER (WHERE (inv.stock_quantity - inv.reserved_quantity) BETWEEN 1 AND 5) AS low_stock,
            COALESCE(SUM(GREATEST(inv.stock_quantity - inv.reserved_quantity, 0) * pv.price), 0) AS stock_value
          FROM product_variants pv
          JOIN inventory inv ON inv.variant_id = pv.id
          JOIN products p ON p.id = pv.product_id
          WHERE pv.is_active = true AND p.status = 'active'
        `,
      ),
      this.prisma.$queryRaw<
        Array<{
          product_id: string;
          variant_id: string;
          name: string;
          sku: string;
          available: bigint;
          units_sold_30d: bigint;
          days_of_cover: number;
        }>
      >(
        Prisma.sql`
          WITH sold30 AS (
            SELECT oi.variant_id, SUM(oi.quantity) AS units
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.status IN (${Prisma.join(VALID_ORDER_STATUSES)})
              AND o.created_at >= now() - interval '30 days'
            GROUP BY oi.variant_id
          )
          SELECT
            p.id AS product_id, pv.id AS variant_id, p.name, pv.sku,
            GREATEST(inv.stock_quantity - inv.reserved_quantity, 0) AS available,
            s.units AS units_sold_30d,
            (GREATEST(inv.stock_quantity - inv.reserved_quantity, 0)::numeric / (s.units::numeric / 30.0)) AS days_of_cover
          FROM sold30 s
          JOIN product_variants pv ON pv.id = s.variant_id
          JOIN inventory inv ON inv.variant_id = pv.id
          JOIN products p ON p.id = pv.product_id
          WHERE pv.is_active = true AND p.status = 'active' AND s.units > 0
            AND (GREATEST(inv.stock_quantity - inv.reserved_quantity, 0)::numeric / (s.units::numeric / 30.0)) < 14
          ORDER BY days_of_cover ASC
          LIMIT 10
        `,
      ),
    ]);

    const summary = summaryRows[0];

    return {
      outOfStockVariants: this.int(summary?.out_of_stock ?? 0),
      lowStockVariants: this.int(summary?.low_stock ?? 0),
      stockValue: this.num(summary?.stock_value ?? 0),
      atRisk: atRiskRows.map((row) => ({
        productId: row.product_id,
        variantId: row.variant_id,
        name: row.name,
        sku: row.sku,
        available: this.int(row.available),
        unitsSold30d: this.int(row.units_sold_30d),
        daysOfCover: this.num(row.days_of_cover),
      })),
    };
  }
}
