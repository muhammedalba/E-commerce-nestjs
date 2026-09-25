import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { WishlistService } from './wishlist.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { AddToWishlistDto } from './shared/dto/add-to-wishlist.dto';
import { SyncWishlistDto } from './shared/dto/sync-wishlist.dto';
import { WishlistEnabledGuard } from './shared/guards/wishlist-enabled.guard';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';

@Controller('wishlist')
@UseGuards(AuthGuard)
@UseInterceptors(ClearCacheInterceptor)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(10000) // 10 seconds
  async getWishlist(@Req() req: { user: JwtPayload }) {
    return await this.wishlistService.getWishlist(req.user.user_id);
  }

  @Get('ids')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(10000) // 10 seconds
  async getIds(@Req() req: { user: JwtPayload }) {
    return await this.wishlistService.getIds(req.user.user_id);
  }

  @Post('add')
  @UseGuards(WishlistEnabledGuard)
  @ClearCache('wishlist')
  async addItem(
    @Req() req: { user: JwtPayload },
    @Body() addToWishlistDto: AddToWishlistDto,
  ) {
    return await this.wishlistService.addItem(
      req.user.user_id,
      addToWishlistDto.productId,
    );
  }

  @Delete('remove/:productId')
  @ClearCache('wishlist')
  removeItem(
    @Req() req: { user: JwtPayload },
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.removeItem(req.user.user_id, productId);
  }

  @Delete('clear')
  @ClearCache('wishlist')
  clear(@Req() req: { user: JwtPayload }) {
    return this.wishlistService.clear(req.user.user_id);
  }

  @Post('sync')
  @UseGuards(WishlistEnabledGuard)
  @ClearCache('wishlist')
  async sync(
    @Req() req: { user: JwtPayload },
    @Body() syncWishlistDto: SyncWishlistDto,
  ) {
    return await this.wishlistService.sync(
      req.user.user_id,
      syncWishlistDto.productIds,
    );
  }
}
