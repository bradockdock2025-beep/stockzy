import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CustomerAuthGuard } from '../customers/customer-auth.guard';
import { WishlistService } from './wishlist.service';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';

@Public()
@Controller('customers/wishlist')
@UseGuards(CustomerAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  get(@Req() req: { customerAuth?: { authUserId: string } }) {
    return this.wishlistService.getWishlist(req.customerAuth?.authUserId ?? '');
  }

  @Post('items')
  addItem(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Body() dto: AddWishlistItemDto,
  ) {
    return this.wishlistService.addItem(req.customerAuth?.authUserId ?? '', dto);
  }

  @Delete('items/:productId')
  @HttpCode(200)
  removeItem(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ) {
    return this.wishlistService.removeItem(req.customerAuth?.authUserId ?? '', productId);
  }

  @Post('items/:productId/move-to-cart')
  moveToCart(
    @Req() req: { customerAuth?: { authUserId: string } },
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Headers('x-cart-token') cartToken: string | undefined,
  ) {
    return this.wishlistService.moveToCart(
      req.customerAuth?.authUserId ?? '',
      productId,
      cartToken,
    );
  }
}
