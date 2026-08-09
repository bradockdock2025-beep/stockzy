import { user_role } from '@prisma/client';

export type AuditContext = {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: user_role | string | null;
  ip?: string | null;
  userAgent?: string | null;
  skip?: boolean;
};

type RequestLike = {
  user?: unknown;
  headers?: Record<string, unknown>;
  ip?: string;
};

export function buildAuditContext(req: RequestLike | undefined): AuditContext {
  if (!req) {
    return {};
  }

  const forwarded = req.headers?.['x-forwarded-for'];
  const ipHeader = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip =
    (typeof ipHeader === 'string' ? ipHeader.split(',')[0].trim() : req.ip) ?? null;

  const userAgentHeader = req.headers?.['user-agent'];
  const userAgent = Array.isArray(userAgentHeader)
    ? userAgentHeader[0]
    : userAgentHeader;

  const user =
    req.user && typeof req.user === 'object'
      ? (req.user as Record<string, unknown>)
      : undefined;

  const actorId = typeof user?.sub === 'string' ? user.sub : null;
  const actorEmail = typeof user?.email === 'string' ? user.email : null;
  const actorRole =
    typeof user?.role === 'string'
      ? user.role
      : (user?.role as user_role | undefined) ?? null;

  return {
    actorId,
    actorEmail,
    actorRole,
    ip: ip || null,
    userAgent: typeof userAgent === 'string' ? userAgent : null,
  };
}
