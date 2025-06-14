import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './shared/dto/create-order.dto';
import { UpdateOrderDto } from './shared/dto/update-order.dto';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';

@Controller('order')
@UseGuards(AuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('PaymentByBankTransfer')
  async checkout(
    @Req() req: { user: JwtPayload },
    @Body() dto: CreateOrderDto,
  ) {
    return await this.orderService.PaymentByBankTransfer(req.user.user_id, dto);
  }
  // This endpoint is used to apply a coupon to an order

  @Post('applyCoupon')
  async applyCoupon(
    @Req() req: { user: JwtPayload },
    @Body() dto: CreateOrderDto,
  ) {
    return await this.orderService.applyCoupon(req.user.user_id, dto);
  }
  @Get()
  findAll() {
    return this.orderService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.orderService.update(+id, updateOrderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orderService.remove(+id);
  }
}
