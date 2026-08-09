import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { UnsubscribeDto } from './dto/unsubscribe.dto';

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(dto: SubscribeDto) {
    const existing = await this.prisma.newsletterSubscription.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('Email already subscribed');
      }
      await this.prisma.newsletterSubscription.update({
        where: { email: dto.email },
        data: { isActive: true, unsubscribedAt: null, subscribedAt: new Date() },
      });
      return { message: 'Subscribed successfully' };
    }

    await this.prisma.newsletterSubscription.create({
      data: { email: dto.email },
    });
    return { message: 'Subscribed successfully' };
  }

  async unsubscribe(dto: UnsubscribeDto) {
    const existing = await this.prisma.newsletterSubscription.findUnique({
      where: { email: dto.email },
    });

    if (!existing || !existing.isActive) {
      throw new NotFoundException('Email not found in newsletter');
    }

    await this.prisma.newsletterSubscription.update({
      where: { email: dto.email },
      data: { isActive: false, unsubscribedAt: new Date() },
    });
    return { message: 'Unsubscribed successfully' };
  }

  async findAll(page = 1, limit = 20, activeOnly = true) {
    const skip = (page - 1) * limit;
    const where = activeOnly ? { isActive: true } : {};

    const [data, total] = await Promise.all([
      this.prisma.newsletterSubscription.findMany({
        where,
        orderBy: { subscribedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.newsletterSubscription.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async remove(id: string) {
    const existing = await this.prisma.newsletterSubscription.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Subscription not found');
    await this.prisma.newsletterSubscription.delete({ where: { id } });
    return { message: 'Subscription removed' };
  }

  async exportAll(activeOnly = true) {
    const where = activeOnly ? { isActive: true } : {};
    const data = await this.prisma.newsletterSubscription.findMany({
      where,
      orderBy: { subscribedAt: 'desc' },
      select: { email: true, isActive: true, subscribedAt: true, unsubscribedAt: true },
    });
    return { total: data.length, data };
  }
}
