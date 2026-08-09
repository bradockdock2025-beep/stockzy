import { Prisma } from '@prisma/client';
import { AuditContext } from './audit-context';
import { AuditContextStore } from './audit-context.store';

export async function applyAuditContext(
  tx: Prisma.TransactionClient,
  context?: AuditContext,
) {
  const ctx = context ?? AuditContextStore.get();
  if (!ctx) {
    return;
  }

  const actorId = ctx.actorId ?? '';
  const actorEmail = ctx.actorEmail ?? '';
  const actorRole = ctx.actorRole ?? '';
  const ip = ctx.ip ?? '';
  const userAgent = ctx.userAgent ?? '';

  await tx.$executeRaw`
    SELECT
      set_config('app.actor_id', ${actorId}, true),
      set_config('app.actor_email', ${actorEmail}, true),
      set_config('app.actor_role', ${actorRole}, true),
      set_config('app.ip', ${ip}, true),
      set_config('app.user_agent', ${userAgent}, true);
  `;
}
