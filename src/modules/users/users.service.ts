import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { user_role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { AuditContext } from '../../common/audit/audit-context';
import { applyAuditContext } from '../../common/audit/audit-context.db';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateUserDto, context?: AuditContext) {
    if (context?.actorRole === user_role.manager && dto.role !== undefined) {
      throw new ForbiddenException('Managers cannot assign roles');
    }

    const email = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, this.getSaltRounds());

    return this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      return tx.user.create({
        data: {
          name: dto.name,
          email,
          passwordHash,
          role: dto.role,
          isActive: dto.isActive ?? true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
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
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
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

    return this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      const existing = await tx.user.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('User not found');
      }

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
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  }

  async remove(id: string, context?: AuditContext) {
    return this.prisma.$transaction(async (tx) => {
      await applyAuditContext(tx, context);
      const existing = await tx.user.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('User not found');
      }

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
          createdAt: true,
          updatedAt: true,
        },
      });
    });
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
