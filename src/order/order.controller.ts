import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  Query,
  UploadedFiles,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
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
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { ParseFileFieldsPipe } from 'src/shared/files/ParseFileFieldsPipe';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';
import { MarketingStatisticsService } from './shared/order-helper/marketing-statistics.service';

@Controller('order')
@UseGuards(AuthGuard)
@UseInterceptors(ClearCacheInterceptor)
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly marketingStatisticsService: MarketingStatisticsService,
  ) {}

  // Image size static
  private static readonly imageSize = [
    { name: 'transferReceiptImg', maxCount: 1 },
    { name: 'InvoicePdf', maxCount: 1 },
    { name: 'DeliveryReceiptImage', maxCount: 1 },
  ];

  // =======================================================================================
  // ========================================= ORDER STATISTICS=============================
  // =======================================================================================
  @Get('statistics')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(300000) // 5 minutes
  @RequirePermission(Permissions.VIEW_ORDERS)
  @UseGuards(AuthGuard, PermissionsGuard)
  async OrdersStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.orderService.OrdersStatistics(startDate, endDate);
  }

  // ========================================================================================
  // =========================================  MARKETING STATISTICS ========================
  // ========================================================================================
  @Get('marketing-statistics')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(300000) // 5 minutes
  @RequirePermission(Permissions.VIEW_ORDERS)
  @UseGuards(AuthGuard, PermissionsGuard)
  async MarketingStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.marketingStatisticsService.getMarketingStatistics(
      startDate,
      endDate,
    );
  }

  // ========================================================================================
  // =========================================  PAYMENT BY BANK TRANSFER =============================
  // ========================================================================================

  // @Post('PaymentByBankTransfer')
  // @ClearCache('order')
  // @UseInterceptors(FileInterceptor('transferReceiptImg'))
  // async checkoutByBankTransfer(
  //   @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], true))
  //   file: MulterFileType,
  //   @Req() req: { user: JwtPayload },
  //   @Body() dto: CreateOrderDto,
  // ) {
  //   return await this.orderService.PaymentByBankTransfer(
  //     req.user.user_id,
  //     req.user.email,
  //     dto,
  //     file,
  //   );
  // }

  // ========================================================================================
  // =========================================  PLACE ORDER (ENTERPRISE) =====================
  // ========================================================================================
  // @Post('placeOrder')
  // @ClearCache('order')
  // async placeOrder(
  //   @Req() req: { user: JwtPayload },
  //   @Body() dto: CreateOrderDto,
  // ) {
  //   return await this.orderService.placeOrder(
  //     req.user.user_id,
  //     req.user.email,
  //     dto,
  //   );
  // }
  // This endpoint is used to apply a coupon to an order

  // ========================================================================================
  // =========================================  GET ALL ORDERS =============================
  // ========================================================================================
  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(30000) // 30 seconds (orders change frequently)
  @RequirePermission(Permissions.VIEW_ORDERS)
  @UseGuards(AuthGuard, PermissionsGuard)
  findAll(@Req() req: { user: JwtPayload }, @Query() queryString: QueryString) {
    return this.orderService.findAll(req.user, queryString);
  }

  // ========================================================================================
  // =========================================  FIND ONE ORDER ==============================
  // ========================================================================================
  @Get(':id')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  @RequirePermission(Permissions.VIEW_ORDERS)
  @UseGuards(AuthGuard, PermissionsGuard)
  async findOne(@Param() idParamDto: IdParamDto) {
    return await this.orderService.findOne(idParamDto.id);
  }

  // ========================================================================================
  // =========================================  UPDATE ORDER ================================
  // ========================================================================================
  @Patch(':id')
  @ClearCache('order')
  @RequirePermission(Permissions.UPDATE_ORDER_STATUS)
  @UseGuards(AuthGuard, PermissionsGuard)
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

  // ========================================================================================
  // =========================================  DELETE ORDER ================================
  // ========================================================================================
  @Delete(':id')
  @ClearCache('order')
  @RequirePermission(Permissions.DELETE_ORDER)
  @UseGuards(AuthGuard, PermissionsGuard)
  async remove(@Param() idParamDto: IdParamDto) {
    return await this.orderService.remove(idParamDto);
  }
}
