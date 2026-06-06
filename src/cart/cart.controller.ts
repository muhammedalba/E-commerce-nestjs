import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ValidateCouponDto } from './shared/dto/validate-coupon.dto';
import { CacheTTL } from '@nestjs/cache-manager';
import { CartService } from './cart.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { CreateCartDto } from './shared/dto/create-cart.dto';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';

@Controller('cart')
@UseGuards(AuthGuard)
@UseInterceptors(ClearCacheInterceptor)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(10000) // 10 seconds
  async getCart(@Req() req: { user: JwtPayload }) {
    return await this.cartService.getCart(req.user.user_id);
  }

  @Post('add')
  @ClearCache('cart')
  async addItem(
    @Req() req: { user: JwtPayload },
    @Body() createCartDto: CreateCartDto,
  ) {
    return await this.cartService.addItem(req.user.user_id, createCartDto);
  }

  @Patch('update-quantity')
  @ClearCache('cart')
  async updateQuantity(
    @Req() req: { user: JwtPayload },
    @Body() updateCartDto: CreateCartDto,
  ) {
    return await this.cartService.updateQuantity(
      req.user.user_id,
      updateCartDto,
    );
  }

  @Delete('remove/:productId')
  @ClearCache('cart')
  removeItem(
    @Req() req: { user: JwtPayload },
    @Param('productId') productId: string,
  ) {
    return this.cartService.removeItem(req.user.user_id, productId);
  }

  @Delete('clear')
  @ClearCache('cart')
  clearCart(@Req() req: { user: JwtPayload }) {
    return this.cartService.clearCart(req.user.user_id);
  }

  @Post('sync')
  @ClearCache('cart')
  async syncCart(
    @Req() req: { user: JwtPayload },
    @Body('items') items: CreateCartDto[],
  ) {
    return await this.cartService.syncCart(req.user.user_id, items);
  }

  // ------------ =============================== ---------- //
  // ------------ ====== VALIDATE COUPON   ====== ---------- //
  // ------------ =============================== ---------- //
  //   @Post('validate-coupon')
  //   async validateCoupon(
  //     @Req() req: { user: JwtPayload },
  //     @Body() body: ValidateCouponDto,
  //   ) {
  //     return await this.cartService.validateCouponForCart(
  //       req.user.user_id,
  //       body.code,
  //       body.orderAmount,
  //     );
  //   }
  //
}
