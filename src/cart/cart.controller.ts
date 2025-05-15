import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';

@Controller('cart')
@UseGuards(AuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() req: { user: JwtPayload }) {
    return;
    // return this.cartService.getCart(req.user.user_id,);
  }

  @Post('add')
  addItem(
    @Req() req: { user: JwtPayload },
    @Body() body: { productId: string; quantity: number },
  ) {
    console.log(req.user);

    return this.cartService.addItem(
      req.user.user_id,
      body.productId,
      body.quantity,
    );
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
