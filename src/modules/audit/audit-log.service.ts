import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditContext } from '../../common/audit/audit-context';
import { AuditContextStore } from '../../common/audit/audit-context.store';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

type AuditActor = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

type AuditLogInput = {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  context?: AuditContext;
  actor?: AuditActor;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryAuditLogDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const where: Prisma.AuditLogWhereInput = {};

    if (query.actorId) {
      where.actorId = query.actorId;
    }

    if (query.actorEmail) {
      where.actorEmail = {
        equals: query.actorEmail.trim().toLowerCase(),
        mode: 'insensitive',
      };
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.entity) {
      where.entity = query.entity;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.createdAt.lte = new Date(query.to);
      }
    }

    const args: Prisma.AuditLogFindManyArgs = {
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    };

    if (query.cursor) {
      args.cursor = { id: query.cursor };
      args.skip = 1;
    }

    let data;
    try {
      data = await this.prisma.auditLog.findMany(args);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new BadRequestException('Invalid cursor');
      }
      throw error;
    }

    const nextCursor = data.length === limit ? data[data.length - 1].id : null;

    return {
      data,
      meta: {
        limit,
        nextCursor,
      },
    };
  }

  async log(input: AuditLogInput) {
    const context = input.context ?? AuditContextStore.get();
    const actorId = input.actor?.id ?? context?.actorId ?? null;
    const actorEmail = input.actor?.email ?? context?.actorEmail ?? null;
    const actorRole = input.actor?.role ?? context?.actorRole ?? null;
    const ip = context?.ip ?? null;
    const userAgent = context?.userAgent ?? null;

    const data: Prisma.AuditLogCreateInput = {
      actorId,
      actorEmail: actorEmail ? actorEmail.trim().toLowerCase() : null,
      actorRole: actorRole ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      before: this.toJsonSafe(input.before),
      after: this.toJsonSafe(input.after),
      ip,
      userAgent,
    };

    try {
      await this.prisma.auditLog.create({ data });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private toJsonSafe(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.DbNull;
    }

    try {
      const seen = new WeakSet();
      const json = JSON.stringify(value, (_key, val) => {
        if (typeof val === 'bigint') {
          return val.toString();
        }
        if (val instanceof Date) {
          return val.toISOString();
        }
        if (val && typeof val === 'object') {
          if ('toJSON' in val && typeof (val as { toJSON: () => unknown }).toJSON === 'function') {
            return (val as { toJSON: () => unknown }).toJSON();
          }
          if (seen.has(val)) {
            return undefined;
          }
          seen.add(val);
        }
        return val;
      });

      return JSON.parse(json) as Prisma.InputJsonValue;
    } catch {
      return Prisma.DbNull;
    }
  }
}
