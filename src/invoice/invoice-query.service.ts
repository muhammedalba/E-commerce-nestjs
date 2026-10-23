import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, PipelineStage, Types } from 'mongoose';
import { resolveStoreTimezone } from 'src/backup/store-timezone';
import { User } from 'src/auth/shared/schema/user.schema';
import { Order } from 'src/order/shared/schemas/Order.schema';
import { SettingsService } from 'src/settings/settings.service';
import { CreditNote } from './schemas/credit-note.schema';
import { Invoice, InvoiceStatus } from './schemas/invoice.schema';
import { FileAsset } from 'src/shared/schema/file-asset.schema';
import { withBaseUrl } from 'src/shared/utils/with-base-url.util';
import { toCsv } from './utils/csv';
import { cleanMoney } from 'src/payments/shared/utils/currency.util';

/** Filters shared by both lists (and the export). */
export interface DocumentQuery {
  /** Number, customer name, order number, customer email or phone. */
  search?: string;
  /** Issue date range (inclusive). */
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export interface InvoiceQuery extends DocumentQuery {
  /** `generated`: issued; `failed` / `pending`: not issued yet. */
  status?: InvoiceStatus;
}

export interface CreditNoteQuery extends DocumentQuery {
  reasonType?: 'defect' | 'other';
  /** Issued (default) or still awaiting its refund; void ones never show. */
  state?: 'issued' | 'awaiting_refund';
}

/** The interceptor turns this into `data` + `meta` (total, pagination). */
export interface Paginated<T> {
  results: number;
  pagination: { currentPage: number; limit: number; numberOfPages: number };
  data: T[];
}

/** Rows a CSV export holds at most: a period, not the whole history. */
export const EXPORT_LIMIT = 10_000;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const REASON_AR = { defect: 'عيب في المنتج', other: 'أسباب أخرى' } as const;
const REFUND_AR: Record<string, string> = {
  moyasar: 'ميسر',
  manual: 'يدوي (تحويل)',
  already_refunded: 'مسترد مسبقاً',
  none: 'بدون استرداد',
};
const STATUS_AR: Record<string, string> = {
  generated: 'صادرة',
  failed: 'فشل الإصدار',
  pending: 'قيد الإصدار',
  generating: 'قيد الإصدار',
};

/**
 * The dashboard's view of the issued tax documents: lists, search, period
 * totals and the accountant's CSV export. Read only: an issued invoice or
 * credit note is never edited or deleted (a credit note corrects it).
 */
@Injectable()
export class InvoiceQueryService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(CreditNote.name)
    private readonly creditNoteModel: Model<CreditNote>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly settingsService: SettingsService,
  ) {}

  /** Invoices, newest first, each with what its credit notes gave back. */
  async listInvoices(query: InvoiceQuery) {
    const { page, limit } = this.paging(query);
    const filter = await this.invoiceFilter(query);
    const [data, total] = await Promise.all([
      this.invoiceModel.aggregate(
        this.invoicePipeline(filter, (page - 1) * limit, limit),
      ),
      this.invoiceModel.countDocuments(filter),
    ]);
    return this.paginated(this.withFileUrls(data), total, page, limit);
  }

  /** Credit notes, newest first, with the invoice they reverse. */
  async listCreditNotes(query: CreditNoteQuery) {
    const { page, limit } = this.paging(query);
    const filter = await this.creditNoteFilter(query);
    const [data, total] = await Promise.all([
      this.creditNoteModel.aggregate(
        this.creditNotePipeline(filter, (page - 1) * limit, limit),
      ),
      this.creditNoteModel.countDocuments(filter),
    ]);
    return this.paginated(this.withFileUrls(data), total, page, limit);
  }

  /**
   * The period's totals: issued invoices and credit notes (count, total,
   * VAT), the net of the two, and what failed to issue (to retry).
   */
  async stats(range: { from?: Date; to?: Date }) {
    const issuedAt = this.dateRange(range);
    type Totals = { count: number; total: number; tax: number };
    const group = (total: string, tax: string): PipelineStage => ({
      $group: {
        _id: null,
        count: { $sum: 1 },
        total: { $sum: total },
        tax: { $sum: tax },
      },
    });
    const [[invoices], [creditNotes], failedInvoices, failedCreditNotes] =
      await Promise.all([
        this.invoiceModel.aggregate<Totals>([
          { $match: { status: 'generated', ...issuedAt } },
          group('$snapshot.amounts.grandTotal', '$snapshot.amounts.tax'),
        ]),
        this.creditNoteModel.aggregate<Totals>([
          { $match: { state: 'issued', ...issuedAt } },
          group('$amounts.total', '$amounts.tax'),
        ]),
        this.invoiceModel.countDocuments({
          status: { $ne: 'generated' },
          ...issuedAt,
        }),
        this.creditNoteModel.countDocuments({
          state: 'issued',
          status: 'failed',
          ...issuedAt,
        }),
      ]);
    const totals = (r?: Totals) => ({
      count: r?.count ?? 0,
      total: cleanMoney(r?.total ?? 0),
      tax: cleanMoney(r?.tax ?? 0),
    });
    const inv = totals(invoices);
    const cn = totals(creditNotes);
    return {
      invoices: inv,
      creditNotes: cn,
      net: {
        total: cleanMoney(inv.total - cn.total),
        tax: cleanMoney(inv.tax - cn.tax),
      },
      failed: { invoices: failedInvoices, creditNotes: failedCreditNotes },
    };
  }

  /**
   * The list as CSV for the accountant (same filters, at most EXPORT_LIMIT
   * rows), dates in the store's timezone, with a totals row.
   */
  async exportCsv(
    type: 'invoices' | 'credit-notes',
    query: InvoiceQuery & CreditNoteQuery,
  ): Promise<string> {
    const settings = await this.settingsService.getSettings();
    const { timezone } = resolveStoreTimezone(
      settings.businessAddress,
      'Asia/Riyadh',
    );
    const day = (date?: Date) =>
      date
        ? new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(date))
        : '';

    if (type === 'invoices') {
      const rows = await this.invoiceModel.aggregate<InvoiceRow>(
        this.invoicePipeline(await this.invoiceFilter(query), 0, EXPORT_LIMIT),
      );
      const sum = (pick: (r: InvoiceRow) => number) =>
        cleanMoney(rows.reduce((s, r) => s + (pick(r) || 0), 0));
      return toCsv(
        [
          'رقم الفاتورة',
          'التاريخ',
          'رقم الطلب',
          'العميل',
          'الرقم الضريبي للعميل',
          'الإجمالي قبل الضريبة',
          'الضريبة',
          'الإجمالي شامل الضريبة',
          'المرتجع منها',
          'الحالة',
        ],
        [
          ...rows.map((r) => [
            r.displayNumber,
            day(r.issuedAt),
            r.invoiceNumber ?? '',
            r.customer?.name ?? '',
            r.customer?.vatNo ?? '',
            r.amounts?.taxableSubtotal ?? 0,
            r.amounts?.tax ?? 0,
            r.amounts?.grandTotal ?? 0,
            r.credited?.total ?? 0,
            STATUS_AR[r.status] ?? r.status,
          ]),
          [
            'الإجمالي',
            '',
            '',
            `${rows.length}`,
            '',
            sum((r) => r.amounts?.taxableSubtotal ?? 0),
            sum((r) => r.amounts?.tax ?? 0),
            sum((r) => r.amounts?.grandTotal ?? 0),
            sum((r) => r.credited?.total ?? 0),
            '',
          ],
        ],
      );
    }

    const rows = await this.creditNoteModel.aggregate<CreditNoteRow>(
      this.creditNotePipeline(
        await this.creditNoteFilter(query),
        0,
        EXPORT_LIMIT,
      ),
    );
    const sum = (pick: (r: CreditNoteRow) => number) =>
      cleanMoney(rows.reduce((s, r) => s + (pick(r) || 0), 0));
    return toCsv(
      [
        'رقم المرتجع',
        'التاريخ',
        'رقم الفاتورة',
        'العميل',
        'السبب',
        'الإجمالي قبل الضريبة',
        'الضريبة',
        'الإجمالي شامل الضريبة',
        'خصم الشحن العكسي',
        'المبلغ المسترد',
        'طريقة الاسترداد',
      ],
      [
        ...rows.map((r) => [
          r.displayNumber ?? '',
          day(r.issuedAt),
          r.invoice?.displayNumber ?? '',
          r.customer?.name ?? '',
          REASON_AR[r.reasonType ?? 'defect'],
          r.amounts?.taxable ?? 0,
          r.amounts?.tax ?? 0,
          r.amounts?.total ?? 0,
          r.deductions?.returnShipping?.total ?? 0,
          r.refund?.amount ?? 0,
          r.refund ? (REFUND_AR[r.refund.via] ?? r.refund.via) : '',
        ]),
        [
          'الإجمالي',
          '',
          '',
          `${rows.length}`,
          '',
          sum((r) => r.amounts?.taxable ?? 0),
          sum((r) => r.amounts?.tax ?? 0),
          sum((r) => r.amounts?.total ?? 0),
          sum((r) => r.deductions?.returnShipping?.total ?? 0),
          sum((r) => r.refund?.amount ?? 0),
          '',
        ],
      ],
    );
  }

  // ── filters ───────────────────────────────────────────────────────────────

  private async invoiceFilter(
    query: InvoiceQuery,
  ): Promise<QueryFilter<Invoice>> {
    const filter: QueryFilter<Invoice> = { ...this.dateRange(query) };
    if (query.status) {
      filter.status =
        query.status === 'generated'
          ? 'generated'
          : { $in: ['failed', 'pending', 'generating'] };
    }
    const search = query.search?.trim();
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      const or: QueryFilter<Invoice>[] = [
        { displayNumber: rx },
        { 'snapshot.customer.name': rx },
      ];
      if (/^\d+$/.test(search)) or.push({ invoiceNumber: Number(search) });
      const orders = await this.ordersOfCustomers(rx);
      if (orders.length) or.push({ order: { $in: orders } });
      filter.$or = or;
    }
    return filter;
  }

  private async creditNoteFilter(
    query: CreditNoteQuery,
  ): Promise<QueryFilter<CreditNote>> {
    const filter: QueryFilter<CreditNote> = {
      state: query.state ?? 'issued',
      ...this.dateRange(query),
    };
    // Older credit notes have no reason: they count as a defect
    if (query.reasonType === 'other') filter.reasonType = 'other';
    if (query.reasonType === 'defect') filter.reasonType = { $ne: 'other' };
    const search = query.search?.trim();
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      const [invoices, orders] = await Promise.all([
        // The invoice it reverses, by number or customer name
        this.invoiceModel
          .find({
            $or: [{ displayNumber: rx }, { 'snapshot.customer.name': rx }],
          })
          .select('_id')
          .limit(EXPORT_LIMIT)
          .lean(),
        this.ordersOfCustomers(rx),
      ]);
      const or: QueryFilter<CreditNote>[] = [{ displayNumber: rx }];
      if (invoices.length)
        or.push({ invoice: { $in: invoices.map((i) => i._id) } });
      if (orders.length) or.push({ order: { $in: orders } });
      filter.$or = or;
    }
    return filter;
  }

  /** Orders of the customers whose email or phone matches. */
  private async ordersOfCustomers(rx: RegExp): Promise<Types.ObjectId[]> {
    const users = await this.userModel
      .find({ $or: [{ email: rx }, { phone: rx }] })
      .select('_id')
      .limit(200)
      .lean();
    if (users.length === 0) return [];
    const orders = await this.orderModel
      .find({ user: { $in: users.map((u) => u._id) } })
      .select('_id')
      .limit(EXPORT_LIMIT)
      .lean();
    return orders.map((o) => o._id);
  }

  private dateRange(range: { from?: Date; to?: Date }) {
    if (!range.from && !range.to) return {};
    return {
      issuedAt: {
        ...(range.from && { $gte: new Date(range.from) }),
        ...(range.to && { $lte: new Date(range.to) }),
      },
    };
  }

  // ── pipelines ─────────────────────────────────────────────────────────────

  private invoicePipeline(
    filter: QueryFilter<Invoice>,
    skip: number,
    limit: number,
  ): PipelineStage[] {
    return [
      { $match: filter },
      { $sort: { issuedAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        // What its issued credit notes gave back
        $lookup: {
          from: this.creditNoteModel.collection.name,
          let: { invoice: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$invoice', '$$invoice'] },
                state: 'issued',
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                total: { $sum: '$amounts.total' },
              },
            },
          ],
          as: 'credited',
        },
      },
      {
        $project: {
          displayNumber: 1,
          invoiceNumber: 1,
          issuedAt: 1,
          order: 1,
          status: 1,
          file: 1,
          lastError: 1,
          customerEmail: '$customerEmail.status',
          customer: {
            name: '$snapshot.customer.name',
            vatNo: '$snapshot.customer.vatNo',
          },
          amounts: {
            taxableSubtotal: '$snapshot.amounts.taxableSubtotal',
            tax: '$snapshot.amounts.tax',
            grandTotal: '$snapshot.amounts.grandTotal',
          },
          credited: {
            $ifNull: [
              { $arrayElemAt: ['$credited', 0] },
              { count: 0, total: 0 },
            ],
          },
        },
      },
    ];
  }

  private creditNotePipeline(
    filter: QueryFilter<CreditNote>,
    skip: number,
    limit: number,
  ): PipelineStage[] {
    return [
      { $match: filter },
      { $sort: { issuedAt: -1, createdAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: this.invoiceModel.collection.name,
          let: { invoice: '$invoice' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$invoice'] } } },
            {
              $project: {
                displayNumber: 1,
                issuedAt: 1,
                customer: {
                  name: '$snapshot.customer.name',
                  vatNo: '$snapshot.customer.vatNo',
                },
              },
            },
          ],
          as: 'invoice',
        },
      },
      { $set: { invoice: { $arrayElemAt: ['$invoice', 0] } } },
      {
        $project: {
          displayNumber: 1,
          issuedAt: 1,
          order: 1,
          state: 1,
          status: 1,
          file: 1,
          reason: 1,
          reasonType: 1,
          source: 1,
          amounts: 1,
          deductions: 1,
          refund: 1,
          returnRequest: 1,
          restocked: 1,
          customerEmail: '$customerEmail.status',
          invoice: { _id: 1, displayNumber: 1, issuedAt: 1 },
          customer: '$invoice.customer',
        },
      },
    ];
  }

  /**
   * Stored file paths are relative (`/uploads/…`, local storage): made
   * absolute on the API server, as the order responses do, or the dashboard
   * would ask the storefront for them.
   */
  private withFileUrls<T extends { file?: FileAsset }>(rows: T[]): T[] {
    return rows.map((row) =>
      row.file ? { ...row, file: withBaseUrl(row.file) } : row,
    );
  }

  private paging(query: DocumentQuery) {
    return {
      page: Math.max(1, query.page ?? 1),
      limit: Math.min(100, Math.max(1, query.limit ?? 20)),
    };
  }

  private paginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): Paginated<T> {
    return {
      results: total,
      pagination: {
        currentPage: page,
        limit,
        numberOfPages: Math.max(1, Math.ceil(total / limit)),
      },
      data,
    };
  }
}

/** An invoice row (the list's projection). */
interface InvoiceRow {
  displayNumber: string;
  invoiceNumber?: number;
  issuedAt?: Date;
  status: string;
  customer?: { name?: string; vatNo?: string };
  amounts?: { taxableSubtotal?: number; tax?: number; grandTotal?: number };
  credited?: { count: number; total: number };
}

/** A credit note row (the list's projection). */
interface CreditNoteRow {
  displayNumber?: string;
  issuedAt?: Date;
  reasonType?: 'defect' | 'other';
  invoice?: { displayNumber?: string };
  customer?: { name?: string };
  amounts?: { taxable?: number; tax?: number; total?: number };
  deductions?: { returnShipping?: { total: number } };
  refund?: { via: string; amount: number };
}
