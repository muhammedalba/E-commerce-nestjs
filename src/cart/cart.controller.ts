import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { CartService } from './cart.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { CreateCartDto } from './shared/dto/create-cart.dto';
import { Cart } from './shared/schemas/cart.schema';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';

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
  async addItem(
    @Req() req: { user: JwtPayload },
    @Body() createCartDto: CreateCartDto,
  ) {
    return await this.cartService.addItem(req.user.user_id, createCartDto);
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
}
