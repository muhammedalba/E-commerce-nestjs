import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { InvoiceQueryService } from 'src/invoice/invoice-query.service';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { OrderService } from './order.service';
import {
  CreditNoteQueryDto,
  ExportQueryDto,
  InvoiceQueryDto,
  NoteIdParamDto,
  OrderIdParamDto,
} from './shared/dto/invoice-query.dto';
import { OrderCreditNoteService } from './shared/order-helper/order-credit-note.service';

/**
 * The dashboard's "Invoices & credit notes" page: lists, search, period
 * totals, the accountant's CSV and resending to the customer. Read only:
 * an issued tax document is never edited or deleted (a credit note corrects
 * it: POST /order/:id/credit-notes). Retrying a failed PDF stays on the order
 * routes (…/invoice/regenerate, …/credit-notes/:noteId/regenerate).
 *
 * Lives in the order module: the guards need AuthModule, which reaches the
 * invoice module through the email module (a cycle there).
 */
@Controller('invoices')
@UseGuards(AuthGuard, PermissionsGuard)
export class InvoicesController {
  constructor(
    private readonly invoiceQueryService: InvoiceQueryService,
    private readonly orderService: OrderService,
    private readonly orderCreditNoteService: OrderCreditNoteService,
  ) {}

  /** Invoices, newest first, with search and filters. */
  @Get()
  @RequirePermission(Permissions.VIEW_INVOICES)
  listInvoices(@Query() query: InvoiceQueryDto) {
    return this.invoiceQueryService.listInvoices(query);
  }

  /** Credit notes, newest first, with search and filters. */
  @Get('credit-notes')
  @RequirePermission(Permissions.VIEW_INVOICES)
  listCreditNotes(@Query() query: CreditNoteQueryDto) {
    return this.invoiceQueryService.listCreditNotes(query);
  }

  /** The period's totals: invoices, credit notes, net, failed. */
  @Get('stats')
  @RequirePermission(Permissions.VIEW_INVOICES)
  async stats(@Query() query: InvoiceQueryDto) {
    return {
      status: 'success',
      data: await this.invoiceQueryService.stats(query),
    };
  }

  /** The list as a CSV file (Excel, UTF-8 with BOM) for the accountant. */
  @Get('export')
  @RequirePermission(Permissions.VIEW_INVOICES)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async export(@Query() query: ExportQueryDto, @Res() res: Response) {
    const csv = await this.invoiceQueryService.exportCsv(query.type, query);
    const stamp = new Date().toISOString().slice(0, 10);
    res
      .status(200)
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${query.type}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      })
      .send(csv);
  }

  /** Emails an issued invoice to the customer again. */
  @Post(':orderId/resend')
  @RequirePermission(Permissions.UPDATE_ORDER_STATUS)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resendInvoice(@Param() params: OrderIdParamDto) {
    await this.orderService.resendInvoiceEmail(params.orderId);
    return { status: 'success', data: { queued: true } };
  }

  /** Emails an issued credit note to the customer again. */
  @Post('credit-notes/:noteId/resend')
  @RequirePermission(Permissions.REFUND_ORDER)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resendCreditNote(@Param() params: NoteIdParamDto) {
    await this.orderCreditNoteService.resendEmail(params.noteId);
    return { status: 'success', data: { queued: true } };
  }
}
