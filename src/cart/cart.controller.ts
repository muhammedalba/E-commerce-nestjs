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
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { CreateCartDto } from './shared/dto/create-cart.dto';
import { SyncCartDto } from './shared/dto/sync-cart.dto';

@Controller('cart')
@UseGuards(AuthGuard)
// No response cache: per-user, write-heavy data (a 10s cache gave ~no hits,
// every write wiped all users' entries, and CartService.clearCart after an
// order bypassed @ClearCache — so a stale cart was served after checkout).
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Req() req: { user: JwtPayload }) {
    return await this.cartService.getCart(req.user.user_id);
  }

  @Post('add')
  async addItem(
    @Req() req: { user: JwtPayload },
    @Body() createCartDto: CreateCartDto,
  ) {
    return await this.cartService.addItem(req.user.user_id, createCartDto);
  }

  @Patch('update-quantity')
  async updateQuantity(
    @Req() req: { user: JwtPayload },
    @Body() updateCartDto: CreateCartDto,
  ) {
    return await this.cartService.updateQuantity(
      req.user.user_id,
      updateCartDto,
    );
  }

  @Delete('remove/:productId/:variantId')
  removeItemVariant(
    @Req() req: { user: JwtPayload },
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.cartService.removeItem(req.user.user_id, productId, variantId);
  }

  @Delete('remove/:productId')
  removeItem(
    @Req() req: { user: JwtPayload },
    @Param('productId') productId: string,
  ) {
    return this.cartService.removeItem(req.user.user_id, productId);
  }

  @Delete('clear')
  clearCart(@Req() req: { user: JwtPayload }) {
    return this.cartService.clearCart(req.user.user_id);
  }

  @Post('sync')
  async syncCart(
    @Req() req: { user: JwtPayload },
    @Body() syncCartDto: SyncCartDto,
  ) {
    return await this.cartService.syncCart(req.user.user_id, syncCartDto.items);
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
