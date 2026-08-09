import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartService } from './cart.service';

@Public()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(
    @Headers('x-cart-token') token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.cartService.getCart(token);
    if (result.isNew) {
      res.setHeader('x-cart-token', result.token);
    }
    return result.cart;
  }

  @Post('items')
  async addItem(
    @Headers('x-cart-token') token: string | undefined,
    @Body() dto: AddCartItemDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.cartService.addItem(token, dto);
    if (result.token && (!token || result.token !== token)) {
      res.setHeader('x-cart-token', result.token);
    }
    return result.cart;
  }

  @Patch('items/:variantId')
  async updateItem(
    @Headers('x-cart-token') token: string | undefined,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body() dto: UpdateCartItemDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.cartService.updateItem(token, variantId, dto.quantity);
    if (result.token && (!token || result.token !== token)) {
      res.setHeader('x-cart-token', result.token);
    }
    return result.cart;
  }

  @Delete('items/:variantId')
  async removeItem(
    @Headers('x-cart-token') token: string | undefined,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.cartService.removeItem(token, variantId);
    if (result.token && (!token || result.token !== token)) {
      res.setHeader('x-cart-token', result.token);
    }
    return result.cart;
  }

  @Delete()
  async clear(
    @Headers('x-cart-token') token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.cartService.clear(token);
    if (result.token && (!token || result.token !== token)) {
      res.setHeader('x-cart-token', result.token);
    }
    return result.cart;
  }
}
