import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

type ShippingInputItem = {
  quantity: number;
  weightKg?: Prisma.Decimal | number | null;
};

@Injectable()
export class ShippingService {
  constructor(private readonly configService: ConfigService) {}

  calculate(input: { items: ShippingInputItem[]; address?: Record<string, unknown> | null }) {
    const localCity = this.getString('SHIPPING_LOCAL_CITY', 'Luanda').toLowerCase();
    const flatRate = this.getNumber('SHIPPING_FLAT_RATE', 0);
    const localRate = this.getNumber('SHIPPING_LOCAL_RATE', flatRate);
    const nationalRate = this.getNumber('SHIPPING_NATIONAL_RATE', flatRate);
    const perKgRate = this.getNumber('SHIPPING_PER_KG_RATE', 0);

    let base = flatRate;
    const cityRaw = typeof input.address?.city === 'string' ? input.address?.city : null;
    if (cityRaw) {
      base = cityRaw.trim().toLowerCase() === localCity ? localRate : nationalRate;
    }

    let totalWeight = 0;
    let hasWeight = false;
    for (const item of input.items) {
      const weight =
        item.weightKg instanceof Prisma.Decimal
          ? item.weightKg.toNumber()
          : typeof item.weightKg === 'number'
            ? item.weightKg
            : null;
      if (weight && weight > 0) {
        totalWeight += weight * Math.max(item.quantity, 0);
        hasWeight = true;
      }
    }

    if (perKgRate > 0 && hasWeight) {
      base += totalWeight * perKgRate;
    }

    if (!Number.isFinite(base) || base < 0) {
      base = 0;
    }

    return new Prisma.Decimal(base);
  }

  private getNumber(key: string, fallback: number) {
    const raw = this.configService.get<string>(key);
    if (!raw) {
      return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return parsed;
  }

  private getString(key: string, fallback: string) {
    const raw = this.configService.get<string>(key);
    if (!raw) {
      return fallback;
    }
    return raw;
  }
}
