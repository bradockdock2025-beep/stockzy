import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Prisma, user_role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { AuditContext } from '../../common/audit/audit-context';
import { applyAuditContext } from '../../common/audit/audit-context.db';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Nunca logar passwordHash no audit trail — só um retrato seguro do registro. */
  private toAuditSnapshot(user: { passwordHash?: string | null } & Record<string, unknown>) {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  /** P2002 de e-mail duplicado dava 500 cru — mesmo tratamento de slug duplicado em marcas/categorias. */
  private throwIfDuplicateEmail(error: unknown, email: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const meta = error.meta as
        | { target?: string[]; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } }
        | undefined;
      const fields = meta?.target ?? meta?.driverAdapterError?.cause?.constraint?.fields ?? [];
      if (fields.includes('email')) {
        throw new ConflictException(`Email "${email}" is already in use.`);
      }
    }
    throw error;
  }

  async create(dto: CreateUserDto, context?: AuditContext) {
    if (context?.actorRole === user_role.manager && dto.role !== undefined) {
      throw new ForbiddenException('Managers cannot assign roles');
    }

    const email = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, this.getSaltRounds());

    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        await applyAuditContext(tx, context);
        return tx.user.create({
          data: {
            name: dto.name,
            email,
            passwordHash,
            role: dto.role ?? user_role.support,
            isActive: dto.isActive ?? true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      });
    } catch (error) {
      this.throwIfDuplicateEmail(error, email);
    }

    await this.auditLog.log({
      action: 'create',
      entity: 'user',
      entityId: result.id,
      after: result,
      context,
    });

    return result;
  }

  async findAll(query: QueryUserDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.role) {
      where.role = query.role;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        mode: 'offset' as const,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto, context?: AuditContext) {
    if (context?.actorRole === user_role.manager && dto.role !== undefined) {
      throw new ForbiddenException('Managers cannot change user roles');
    }

    let before: Record<string, unknown> | undefined;
    let updated;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        await applyAuditContext(tx, context);
        const existing = await tx.user.findUnique({ where: { id } });
        if (!existing) {
          throw new NotFoundException('User not found');
        }
        before = existing;

        const data: Record<string, unknown> = {};
        if (dto.name !== undefined) {
          data.name = dto.name;
        }
        if (dto.email !== undefined) {
          data.email = dto.email.trim().toLowerCase();
        }
        if (dto.role !== undefined) {
          data.role = dto.role;
        }
        if (dto.isActive !== undefined) {
          data.isActive = dto.isActive;
        }
        if (dto.password) {
          data.passwordHash = await bcrypt.hash(dto.password, this.getSaltRounds());
        }

        return tx.user.update({
          where: { id },
          data,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      });
    } catch (error) {
      this.throwIfDuplicateEmail(error, dto.email ?? '');
    }

    await this.auditLog.log({
      action: 'update',
      entity: 'user',
      entityId: id,
      before: before ? this.toAuditSnapshot(before as { passwordHash?: string | null }) : undefined,
      after: updated,
      context,
    });

    return updated;
  }

  async remove(id: string, context?: AuditContext) {
    let before: Record<string, unknown> | undefined;
    const updated = await this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      const existing = await tx.user.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('User not found');
      }
      before = existing;

      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return tx.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    await this.auditLog.log({
      action: 'deactivate',
      entity: 'user',
      entityId: id,
      before: before ? this.toAuditSnapshot(before as { passwordHash?: string | null }) : undefined,
      after: updated,
      context,
    });

    return updated;
  }

  private getSaltRounds() {
    const raw = this.configService.get<string>('BCRYPT_SALT_ROUNDS');
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 10;
    }
    return parsed;
  }
}
