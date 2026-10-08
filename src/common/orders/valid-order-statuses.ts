import { order_status } from '@prisma/client';

/**
 * "Pedido válido" — definição única usada pra receita/KPIs em todo o backend
 * (Dashboard operacional, Painel Executivo). Exclui pending (ainda não pago),
 * cancelled e refunded — somar esses infla a receita real.
 */
export const VALID_ORDER_STATUSES: order_status[] = [
  order_status.paid,
  order_status.presale,
  order_status.processing,
  order_status.shipped,
  order_status.delivered,
];
