import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { QueryAnnouncementDto } from './dto/query-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAnnouncementDto) {
    return this.prisma.announcement.create({
      data: {
        textPt: dto.textPt,
        textFr: dto.textFr ?? null,
        textEn: dto.textEn ?? null,
        textEs: dto.textEs ?? null,
        link: dto.link ?? null,
        linkTextPt: dto.linkTextPt ?? null,
        linkTextFr: dto.linkTextFr ?? null,
        linkTextEn: dto.linkTextEn ?? null,
        linkTextEs: dto.linkTextEs ?? null,
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        position: dto.position ?? 0,
      },
    });
  }

  async findAll(query: QueryAnnouncementDto) {
    const where: Prisma.AnnouncementWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    if (query.cursor) {
      const limit = Number(query.limit) || 20;
      const data = await this.prisma.announcement.findMany({
        where,
        take: limit,
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        cursor: { id: query.cursor },
        skip: 1,
      });
      return {
        data,
        meta: { limit, nextCursor: data.length === limit ? data[data.length - 1]?.id : null },
      };
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findActive(locale?: string) {
    const now = new Date();
    const announcements = await this.prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [
          { startsAt: { equals: null }, endsAt: { equals: null } },
          { startsAt: { lte: now }, endsAt: { equals: null } },
          { startsAt: { equals: null }, endsAt: { gte: now } },
          { startsAt: { lte: now }, endsAt: { gte: now } },
        ],
      },
      orderBy: { position: 'asc' },
    });

    if (!locale) return announcements;

    return announcements.map((a) => ({
      id: a.id,
      text: this.resolveText(a, locale as 'pt' | 'fr' | 'en' | 'es'),
      linkText: this.resolveLinkText(a, locale as 'pt' | 'fr' | 'en' | 'es'),
      link: a.link,
      position: a.position,
    }));
  }

  async findOne(id: string) {
    const announcement = await this.prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    return announcement;
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    await this.findOne(id);

    const data: Prisma.AnnouncementUpdateInput = {};
    if (dto.textPt !== undefined) data.textPt = dto.textPt;
    if (dto.textFr !== undefined) data.textFr = dto.textFr ?? null;
    if (dto.textEn !== undefined) data.textEn = dto.textEn ?? null;
    if (dto.textEs !== undefined) data.textEs = dto.textEs ?? null;
    if (dto.link !== undefined) data.link = dto.link ?? null;
    if (dto.linkTextPt !== undefined) data.linkTextPt = dto.linkTextPt ?? null;
    if (dto.linkTextFr !== undefined) data.linkTextFr = dto.linkTextFr ?? null;
    if (dto.linkTextEn !== undefined) data.linkTextEn = dto.linkTextEn ?? null;
    if (dto.linkTextEs !== undefined) data.linkTextEs = dto.linkTextEs ?? null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.startsAt !== undefined) data.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined) data.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.position !== undefined) data.position = dto.position;

    return this.prisma.announcement.update({ where: { id }, data });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.announcement.update({ where: { id }, data: { isActive: false } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.announcement.delete({ where: { id } });
  }

  private resolveText(
    a: { textPt: string; textFr: string | null; textEn: string | null; textEs: string | null },
    locale: 'pt' | 'fr' | 'en' | 'es',
  ): string {
    const map = { pt: a.textPt, fr: a.textFr, en: a.textEn, es: a.textEs };
    return map[locale] ?? a.textPt;
  }

  private resolveLinkText(
    a: { linkTextPt: string | null; linkTextFr: string | null; linkTextEn: string | null; linkTextEs: string | null },
    locale: 'pt' | 'fr' | 'en' | 'es',
  ): string | null {
    const map = { pt: a.linkTextPt, fr: a.linkTextFr, en: a.linkTextEn, es: a.linkTextEs };
    return map[locale] ?? a.linkTextPt;
  }
}
