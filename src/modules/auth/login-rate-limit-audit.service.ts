import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { QueryLoginRateLimitAuditDto } from './dto/query-login-rate-limit-audit.dto';

@Injectable()
export class LoginRateLimitAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryLoginRateLimitAuditDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const where: Prisma.LoginRateLimitAuditWhereInput = {};

    if (query.email) {
      where.email = {
        equals: query.email.trim().toLowerCase(),
        mode: 'insensitive',
      };
    }

    if (query.ip) {
      where.ip = query.ip.trim();
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

    const args: Prisma.LoginRateLimitAuditFindManyArgs = {
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
      data = await this.prisma.loginRateLimitAudit.findMany(args);
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
}
