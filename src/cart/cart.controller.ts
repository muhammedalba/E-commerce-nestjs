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
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { CreateCartDto } from './shared/dto/create-cart.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Cart } from './shared/schemas/cart.schema';

@ApiTags('Cart')
@Controller('cart')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: "Get the user's cart" })
  @ApiOkResponse({ description: 'Cart retrieved successfully.', type: Cart })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized.' })
  async getCart(@Req() req: { user: JwtPayload }) {
    return await this.cartService.getCart(req.user.user_id);
  }

  @Post('add')
  @ApiOperation({ summary: 'Add an item to the cart' })
  @ApiBody({ type: CreateCartDto })
  @ApiOkResponse({ description: 'Item added to cart successfully.', type: Cart })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request. Invalid input data.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized.' })
  async addItem(
    @Req() req: { user: JwtPayload },
    @Body() createCartDto: CreateCartDto,
  ) {
    return await this.cartService.addItem(req.user.user_id, createCartDto);
  }

  @Delete('remove/:productId')
  @ApiOperation({ summary: 'Remove an item from the cart' })
  @ApiParam({ name: 'productId', description: 'ID of the product to remove', type: String })
  @ApiOkResponse({ description: 'Item removed from cart successfully.', type: Cart })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized.' })
  removeItem(
    @Req() req: { user: JwtPayload },
    @Param('productId') productId: string,
  ) {
    return this.cartService.removeItem(req.user.user_id, productId);
  }

  @Delete('clear')
  @ApiOperation({ summary: 'Clear the entire cart' })
  @ApiOkResponse({ description: 'Cart cleared successfully.', type: Cart })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized.' })
  clearCart(@Req() req: { user: JwtPayload }) {
    return this.cartService.clearCart(req.user.user_id);
  }
}
