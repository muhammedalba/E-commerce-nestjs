import {
  Controller,
  Get,
  Body,
  Patch,
  Post,
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
import { UpdateOrderDto } from './shared/dto/update-order.dto';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
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
import { InvoiceService } from 'src/invoice/invoice.service';
import { CreditNoteService } from 'src/invoice/credit-note.service';
import { OrderCreditNoteService } from './shared/order-helper/order-credit-note.service';
import { OrderReturnRequestService } from './shared/order-helper/order-return-request.service';
import {
  ApproveReturnRequestDto,
  CreateCreditNoteDto,
  CreateReturnRequestDto,
  CreditNoteParamDto,
  PreviewCreditNoteDto,
  RejectReturnRequestDto,
  ReturnRequestParamDto,
  ReturnRequestQueryDto,
} from './shared/dto/credit-note.dto';

@Controller('order')
@UseGuards(AuthGuard)
@UseInterceptors(ClearCacheInterceptor)
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly marketingStatisticsService: MarketingStatisticsService,
    private readonly invoiceService: InvoiceService,
    private readonly creditNoteService: CreditNoteService,
    private readonly orderCreditNoteService: OrderCreditNoteService,
    private readonly orderReturnRequestService: OrderReturnRequestService,
  ) {}

  // Image size static
  private static readonly imageSize = [
    { name: 'transferReceiptImg', maxCount: 1 },
    { name: 'InvoicePdf', maxCount: 1 },
    { name: 'DeliveryReceiptImage', maxCount: 1 },
  ];

  // =======================================================================================
  // ========================================= ORDER STATISTICS =============================
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
  // =========================================  GET MY ORDERS ==============================
  // ========================================================================================
  @Get('my-orders')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(30000) // 30 seconds (orders change frequently)
  findMyOrders(
    @Req() req: { user: JwtPayload },
    @Query() queryString: QueryString,
  ) {
    return this.orderService.findMyOrders(req.user.user_id, queryString);
  }

  // ========================================================================================
  // =========================================  GET MY ORDER (ONE) ==========================
  // ========================================================================================
  @Get('my-orders/:id')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(30000) // 30 seconds
  findMyOrder(
    @Req() req: { user: JwtPayload },
    @Param() idParamDto: IdParamDto,
  ) {
    return this.orderService.findMyOrder(req.user.user_id, idParamDto.id);
  }

  // ========================================================================================
  // =================================  RETURN REQUESTS (CUSTOMER) ==========================
  // ========================================================================================
  /** What a return would give back (reason, lines); nothing is saved. */
  @Post('my-orders/:id/return-requests/preview')
  async previewMyReturn(
    @Req() req: { user: JwtPayload },
    @Param() idParamDto: IdParamDto,
    @Body() body: PreviewCreditNoteDto,
  ) {
    return {
      status: 'success',
      data: await this.orderReturnRequestService.previewForCustomer(
        req.user.user_id,
        idParamDto.id,
        body,
      ),
    };
  }

  /** Asks for a return, within the return window after delivery. */
  @Post('my-orders/:id/return-requests')
  @ClearCache('order')
  async requestReturn(
    @Req() req: { user: JwtPayload },
    @Param() idParamDto: IdParamDto,
    @Body() body: CreateReturnRequestDto,
  ) {
    return {
      status: 'success',
      data: await this.orderReturnRequestService.create(
        req.user.user_id,
        idParamDto.id,
        {
          lines: body.lines,
          reasonType: body.reasonType,
          note: body.note.trim(),
        },
      ),
    };
  }

  /** Withdraws a request that is still pending. */
  @Delete('my-orders/:id/return-requests/:requestId')
  @ClearCache('order')
  async cancelMyReturn(
    @Req() req: { user: JwtPayload },
    @Param() params: ReturnRequestParamDto,
  ) {
    return {
      status: 'success',
      data: await this.orderReturnRequestService.cancel(
        req.user.user_id,
        params.id,
        params.requestId,
      ),
    };
  }

  // ========================================================================================
  // =================================  RETURN REQUESTS (DASHBOARD) =========================
  // ========================================================================================
  /** Every order's return requests, newest first (before `:id`). */
  @Get('return-requests')
  @RequirePermission(Permissions.REFUND_ORDER)
  @UseGuards(AuthGuard, PermissionsGuard)
  listReturnRequests(@Query() query: ReturnRequestQueryDto) {
    return this.orderReturnRequestService.list(query);
  }

  /**
   * Approves a request: issues its credit note with the request's reason
   * (refund, restock, email), optionally with other quantities.
   */
  @Post(':id/return-requests/:requestId/approve')
  @ClearCache('order')
  @RequirePermission(Permissions.REFUND_ORDER)
  @UseGuards(AuthGuard, PermissionsGuard)
  async approveReturnRequest(
    @Param() params: ReturnRequestParamDto,
    @Body() body: ApproveReturnRequestDto,
    @Req() req: { user: JwtPayload },
  ) {
    const note = await this.orderReturnRequestService.approve(
      params.id,
      params.requestId,
      body,
      { id: req.user.user_id, email: req.user.email },
    );
    return {
      status: 'success',
      data: {
        _id: note._id,
        displayNumber: note.displayNumber,
        amounts: note.amounts,
        refund: note.refund,
      },
    };
  }

  /** Rejects a request; the customer is emailed the reason. */
  @Post(':id/return-requests/:requestId/reject')
  @ClearCache('order')
  @RequirePermission(Permissions.REFUND_ORDER)
  @UseGuards(AuthGuard, PermissionsGuard)
  async rejectReturnRequest(
    @Param() params: ReturnRequestParamDto,
    @Body() body: RejectReturnRequestDto,
    @Req() req: { user: JwtPayload },
  ) {
    return {
      status: 'success',
      data: await this.orderReturnRequestService.reject(
        params.id,
        params.requestId,
        body.reason.trim(),
        { id: req.user.user_id },
      ),
    };
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
  // ==================================  REGENERATE INVOICE ================================
  // ========================================================================================
  /** Retries an invoice that could not be issued (same data and number). */
  @Post(':id/invoice/regenerate')
  @ClearCache('order')
  @RequirePermission(Permissions.UPDATE_ORDER_STATUS)
  @UseGuards(AuthGuard, PermissionsGuard)
  async regenerateInvoice(@Param() idParamDto: IdParamDto) {
    const invoice = await this.invoiceService.regenerate(idParamDto.id);
    return {
      status: 'success',
      data: { number: invoice.displayNumber, InvoicePdf: invoice.file },
    };
  }

  // ========================================================================================
  // ====================================  CREDIT NOTES =====================================
  // ========================================================================================
  /** What can still be returned, and any refund no credit note covers yet. */
  @Get(':id/credit-notes/summary')
  @RequirePermission(Permissions.REFUND_ORDER)
  @UseGuards(AuthGuard, PermissionsGuard)
  async creditNoteSummary(@Param() idParamDto: IdParamDto) {
    return {
      status: 'success',
      data: await this.creditNoteService.summary(idParamDto.id),
    };
  }

  /** A return's amounts and VAT, computed by the server; nothing is saved. */
  @Post(':id/credit-notes/preview')
  @RequirePermission(Permissions.REFUND_ORDER)
  @UseGuards(AuthGuard, PermissionsGuard)
  async previewCreditNote(
    @Param() idParamDto: IdParamDto,
    @Body() body: PreviewCreditNoteDto,
  ) {
    return {
      status: 'success',
      data: await this.orderCreditNoteService.preview(
        idParamDto.id,
        body.lines,
        body.reasonType,
      ),
    };
  }

  /**
   * Returns items: refunds them (Moyasar, or recorded for COD/transfer),
   * issues the tax credit note, restocks, and emails the customer its PDF.
   */
  @Post(':id/credit-notes')
  @ClearCache('order')
  @RequirePermission(Permissions.REFUND_ORDER)
  @UseGuards(AuthGuard, PermissionsGuard)
  async createCreditNote(
    @Param() idParamDto: IdParamDto,
    @Body() body: CreateCreditNoteDto,
    @Req() req: { user: JwtPayload },
  ) {
    const note = await this.orderCreditNoteService.createFromAdmin(
      idParamDto.id,
      {
        lines: body.lines,
        reason: body.reason.trim(),
        reasonType: body.reasonType,
        restock: body.restock ?? true,
      },
      { id: req.user.user_id, email: req.user.email },
    );
    return {
      status: 'success',
      data: {
        _id: note._id,
        displayNumber: note.displayNumber,
        amounts: note.amounts,
        refund: note.refund,
      },
    };
  }

  /** Retries a credit note PDF that could not be rendered. */
  @Post(':id/credit-notes/:noteId/regenerate')
  @ClearCache('order')
  @RequirePermission(Permissions.REFUND_ORDER)
  @UseGuards(AuthGuard, PermissionsGuard)
  async regenerateCreditNote(@Param() params: CreditNoteParamDto) {
    const pdf = await this.creditNoteService.regenerate(
      params.id,
      params.noteId,
    );
    return {
      status: 'success',
      data: { number: pdf.displayNumber, file: pdf.file },
    };
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
