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
  Query,
  UploadedFiles,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './shared/dto/create-order.dto';
import { UpdateOrderDto } from './shared/dto/update-order.dto';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { Roles } from 'src/auth/shared/decorators/rolesdecorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { ParseFileFieldsPipe } from 'src/shared/files/ParseFileFieldsPipe';

@Controller('order')
@UseGuards(AuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}
  private static readonly imageSize = [
    { name: 'transferReceiptImg', maxCount: 1 },
    { name: 'InvoicePdf', maxCount: 1 },
    { name: 'DeliveryReceiptImage', maxCount: 1 },
  ];

  @Post('PaymentByBankTransfer')
  @UseInterceptors(FileInterceptor('transferReceiptImg'))
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
  async applyCoupon(
    @Req() req: { user: JwtPayload },
    @Body() dto: CreateOrderDto,
  ) {
    return await this.orderService.applyCoupon(req.user.user_id, dto);
  }
  @Get()
  findAll(@Req() req: { user: JwtPayload }, @Query() queryString: QueryString) {
    return this.orderService.findAll(req.user, queryString);
  }

  @Get(':id')
  async findOne(@Param() idParamDto: IdParamDto) {
    return await this.orderService.findOne(idParamDto.id);
  }

  @Patch(':id')
  @Roles(roles.ADMIN, roles.MANAGER)
  @UseInterceptors(FileFieldsInterceptor(OrderController.imageSize))
  async update(
    @UploadedFiles(
      new ParseFileFieldsPipe(
        '1MB',
        ['png', 'jpeg', 'webp', 'pdf'],
        [
          { name: 'transferReceiptImg', required: false },
          { name: 'DeliveryReceiptImage', required: false },
          { name: 'InvoicePdf', required: false },
        ],
      ),
    ) // @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], true))
    files: {
      transferReceiptImg: MulterFileType;
      DeliveryReceiptImage: MulterFileType;
      InvoicePdf: MulterFileType;
    },
    @Param() idParamDto: IdParamDto,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return await this.orderService.update(idParamDto, updateOrderDto, files);
  }

  @Delete(':id')
  @Roles(roles.ADMIN, roles.MANAGER)
  async remove(@Param() idParamDto: IdParamDto) {
    return await this.orderService.remove(idParamDto);
  }
}
