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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './shared/dto/create-order.dto';
import { UpdateOrderDto } from './shared/dto/update-order.dto';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';

@Controller('order')
@UseGuards(AuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}
  @UseInterceptors(FileInterceptor('transferReceiptImg'))
  @Post('PaymentByBankTransfer')
  async checkoutByBankTransfer(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], true))
    file: MulterFileType,
    @Req() req: { user: JwtPayload },
    @Body() dto: CreateOrderDto,
  ) {
    return await this.orderService.PaymentByBankTransfer(
      req.user.user_id,
      req.user.email,
      dto,
      file,
    );
  }
  // This endpoint is used to apply a coupon to an order

  @Post('applyCoupon')
  // async applyCoupon(
  //   @Req() req: { user: JwtPayload },
  //   @Body() dto: CreateOrderDto,
  // ) {
  //   return await this.orderService.applyCoupon(req.user.user_id, dto);
  // }
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
