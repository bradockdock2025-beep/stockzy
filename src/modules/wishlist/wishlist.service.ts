import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CartService } from '../cart/cart.service';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
  ) {}

  private async resolveCustomerId(authUserId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer.id;
  }

  private async getOrCreateWishlist(customerId: string) {
    const existing = await this.prisma.wishlist.findUnique({
      where: { customerId },
    });
    if (existing) return existing;

    return this.prisma.wishlist.create({
      data: { customerId },
    });
  }

  async getWishlist(authUserId: string) {
    const customerId = await this.resolveCustomerId(authUserId);
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { customerId },
      include: {
        items: {
          orderBy: { addedAt: 'desc' },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                images: {
                  where: { variantId: null },
                  orderBy: { position: 'asc' },
                  take: 1,
                  select: { url: true, altText: true },
                },
                variants: {
                  where: { isActive: true },
                  orderBy: { price: 'asc' },
                  take: 1,
                  select: {
                    id: true,
                    price: true,
                    compareAtPrice: true,
                    inventory: { select: { stockQuantity: true, reservedQuantity: true } },
                  },
                },
                category: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        },
      },
    });

    if (!wishlist) {
      return { id: null, customerId, items: [], total: 0 };
    }

    return {
      id: wishlist.id,
      customerId: wishlist.customerId,
      total: wishlist.items.length,
      items: wishlist.items.map((item) => ({
        id: item.id,
        addedAt: item.addedAt,
        product: this.formatProduct(item.product),
      })),
    };
  }

  async addItem(authUserId: string, dto: AddWishlistItemDto) {
    const customerId = await this.resolveCustomerId(authUserId);

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const wishlist = await this.getOrCreateWishlist(customerId);

    const existing = await this.prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId: dto.productId } },
    });
    if (existing) {
      throw new ConflictException('Product already in wishlist');
    }

    await this.prisma.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId: dto.productId },
    });

    return this.getWishlist(authUserId);
  }

  async removeItem(authUserId: string, productId: string) {
    const customerId = await this.resolveCustomerId(authUserId);

    const wishlist = await this.prisma.wishlist.findUnique({
      where: { customerId },
      select: { id: true },
    });
    if (!wishlist) {
      throw new NotFoundException('Wishlist not found');
    }

    const item = await this.prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    });
    if (!item) {
      throw new NotFoundException('Item not found in wishlist');
    }

    await this.prisma.wishlistItem.delete({ where: { id: item.id } });

    return this.getWishlist(authUserId);
  }

  async moveToCart(authUserId: string, productId: string, cartToken?: string) {
    const customerId = await this.resolveCustomerId(authUserId);

    const wishlist = await this.prisma.wishlist.findUnique({
      where: { customerId },
      select: { id: true },
    });
    if (!wishlist) {
      throw new NotFoundException('Wishlist not found');
    }

    const item = await this.prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
      include: {
        product: {
          include: {
            variants: {
              where: { isActive: true },
              orderBy: { price: 'asc' },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });
    if (!item) {
      throw new NotFoundException('Item not found in wishlist');
    }

    const firstVariant = item.product.variants[0];
    if (!firstVariant) {
      throw new NotFoundException('Product has no available variants');
    }

    const cartResult = await this.cartService.addItem(cartToken, {
      variantId: firstVariant.id,
      quantity: 1,
    });

    await this.prisma.wishlistItem.delete({ where: { id: item.id } });

    return {
      cart: cartResult.cart,
      cartToken: cartResult.token,
    };
  }

  private formatProduct(product: {
    id: string;
    name: string;
    slug: string;
    status: string;
    images: { url: string; altText: string | null }[];
    variants: {
      id: string;
      price: object;
      compareAtPrice: object | null;
      inventory: { stockQuantity: number; reservedQuantity: number } | null;
    }[];
    category: { id: string; name: string; slug: string };
  }) {
    const variant = product.variants[0] ?? null;
    const price = variant ? Number(variant.price) : null;
    const compareAtPrice = variant?.compareAtPrice ? Number(variant.compareAtPrice) : null;
    const stock = variant?.inventory
      ? variant.inventory.stockQuantity - variant.inventory.reservedQuantity
      : 0;

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      image: product.images[0] ?? null,
      price,
      compareAtPrice,
      discountPercent:
        price && compareAtPrice && compareAtPrice > price
          ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
          : null,
      inStock: stock > 0,
      category: product.category,
    };
  }
}
