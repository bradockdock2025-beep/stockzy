import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { isUUID } from 'class-validator';
import { product_status } from '@prisma/client';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../database/prisma.service';

type CartItem = {
  variantId: string;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  updatedAt: string;
};

export interface HydratedCartItem {
  variantId: string;
  quantity: number;
  available: boolean;
  sku: string | null;
  price: number | null;
  stockAvailable: number | null;
  product: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
    brand: string | null;
  } | null;
}

export interface CartResponse {
  token: string;
  items: HydratedCartItem[];
  subtotal: number;
  updatedAt: string;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getCart(token?: string) {
    const { token: resolvedToken, cart, isNew } = await this.loadCart(token);
    return { token: resolvedToken, cart, isNew };
  }

  async addItem(token: string | undefined, item: CartItem) {
    const { token: resolvedToken, state } = await this.loadCart(token);
    const existing = state.items.find((entry) => entry.variantId === item.variantId);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      state.items.push({ variantId: item.variantId, quantity: item.quantity });
    }

    state.updatedAt = new Date().toISOString();
    await this.saveCart(resolvedToken, state);

    return {
      token: resolvedToken,
      cart: await this.toResponse(resolvedToken, state),
    };
  }

  async updateItem(token: string | undefined, variantId: string, quantity: number) {
    const { token: resolvedToken, state } = await this.loadCart(token);

    state.items = state.items.filter((entry) => entry.variantId !== variantId);
    if (quantity > 0) {
      state.items.push({ variantId, quantity });
    }

    state.updatedAt = new Date().toISOString();
    await this.saveCart(resolvedToken, state);

    return {
      token: resolvedToken,
      cart: await this.toResponse(resolvedToken, state),
    };
  }

  async removeItem(token: string | undefined, variantId: string) {
    const { token: resolvedToken, state } = await this.loadCart(token);
    state.items = state.items.filter((entry) => entry.variantId !== variantId);
    state.updatedAt = new Date().toISOString();
    await this.saveCart(resolvedToken, state);

    return {
      token: resolvedToken,
      cart: await this.toResponse(resolvedToken, state),
    };
  }

  async clear(token?: string) {
    const { token: resolvedToken } = await this.loadCart(token);
    const state: CartState = { items: [], updatedAt: new Date().toISOString() };
    await this.saveCart(resolvedToken, state);

    return {
      token: resolvedToken,
      cart: await this.toResponse(resolvedToken, state),
    };
  }

  /**
   * Resolve cada item do carrinho (só {variantId, quantity} no Redis) contra o
   * catálogo real — nome/imagem/marca/preço/estoque. Item cujo variant não existe
   * mais, está inativo, ou cujo produto não está ativo, vem marcado `available: false`
   * (não é removido do carrinho silenciosamente — o frontend decide o que mostrar).
   */
  private async hydrateItems(items: CartItem[]): Promise<HydratedCartItem[]> {
    if (!items.length) {
      return [];
    }

    const variantIds = items.map((item) => item.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
            brand: { select: { name: true } },
          },
        },
        inventory: true,
      },
    });

    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

    return items.map((item) => {
      const variant = variantsById.get(item.variantId);
      const isActive = !!variant && variant.isActive && variant.product.status === product_status.active;

      if (!variant || !isActive) {
        return {
          variantId: item.variantId,
          quantity: item.quantity,
          available: false,
          sku: null,
          price: null,
          stockAvailable: null,
          product: null,
        };
      }

      const stockAvailable = variant.inventory
        ? variant.inventory.stockQuantity - variant.inventory.reservedQuantity
        : 0;
      const price = variant.presaleEnabled && variant.presalePrice ? variant.presalePrice : variant.price;
      const hasStock = variant.presaleEnabled || stockAvailable >= item.quantity;

      return {
        variantId: item.variantId,
        quantity: item.quantity,
        available: hasStock,
        sku: variant.sku,
        price: Number(price),
        stockAvailable,
        product: {
          id: variant.product.id,
          name: variant.product.name,
          slug: variant.product.slug,
          image: variant.product.images[0]?.url ?? null,
          brand: variant.product.brand?.name ?? null,
        },
      };
    });
  }

  private async toResponse(token: string, state: CartState): Promise<CartResponse> {
    const items = await this.hydrateItems(state.items);
    const subtotal = items.reduce(
      (sum, item) => sum + (item.available && item.price ? item.price * item.quantity : 0),
      0,
    );
    return { token, items, subtotal, updatedAt: state.updatedAt };
  }

  private getClient() {
    const client = this.redisService.getClient();
    if (!client || !this.redisService.isReady()) {
      throw new ServiceUnavailableException('Redis is not available.');
    }
    return client;
  }

  private getCartKey(token: string) {
    return `cart:${token}`;
  }

  private getCartTtlSeconds(): number {
    const raw = this.configService.get<string>('CART_TTL_SECONDS');
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return 60 * 60 * 24 * 7;
  }

  private resolveToken(token?: string) {
    if (token && isUUID(token)) {
      return token;
    }

    return randomUUID();
  }

  private async loadCart(token?: string) {
    const resolvedToken = this.resolveToken(token);
    const client = this.getClient();
    const key = this.getCartKey(resolvedToken);

    const raw = await client.get(key);
    if (!raw) {
      const state: CartState = {
        items: [],
        updatedAt: new Date().toISOString(),
      };
      await this.saveCart(resolvedToken, state);
      return { token: resolvedToken, cart: await this.toResponse(resolvedToken, state), isNew: true, state };
    }

    try {
      const state = JSON.parse(raw) as CartState;
      await client.expire(key, this.getCartTtlSeconds());
      return { token: resolvedToken, cart: await this.toResponse(resolvedToken, state), isNew: false, state };
    } catch (error) {
      this.logger.warn(`Invalid cart payload for token ${resolvedToken}. Resetting cart.`);
      const state: CartState = {
        items: [],
        updatedAt: new Date().toISOString(),
      };
      await this.saveCart(resolvedToken, state);
      return { token: resolvedToken, cart: await this.toResponse(resolvedToken, state), isNew: true, state };
    }
  }

  private async saveCart(token: string, state: CartState) {
    const client = this.getClient();
    const key = this.getCartKey(token);
    await client.set(key, JSON.stringify(state), { EX: this.getCartTtlSeconds() });
  }
}
