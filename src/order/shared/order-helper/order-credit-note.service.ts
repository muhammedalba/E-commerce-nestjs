import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from 'src/auth/shared/schema/user.schema';
import {
  CreditNoteRefund,
  CreditNoteService,
} from 'src/invoice/credit-note.service';
import {
  refundableAmount,
  RequestedLine,
  ReturnPolicyInput,
  ReturnReasonType,
} from 'src/invoice/credit-note.calculator';
import { CreditNoteDocument } from 'src/invoice/schemas/credit-note.schema';
import { PaymentRefundService } from 'src/payments/payment-refund.service';
import { PaymentStatus } from 'src/payments/shared/enums/payment-status.enum';
import { cleanMoney } from 'src/payments/shared/utils/currency.util';
import { SettingsService } from 'src/settings/settings.service';
import { ShippingRatesService } from 'src/shipping/shipping-rates.service';
import { UnitConverter } from 'src/shared/utils/unit-converter.util';
import { Order } from '../schemas/Order.schema';
import { OrderEmailService } from './order-email.service';
import { ProductHelperService } from './product.helper';

const PAID_STATUSES: string[] = [
  PaymentStatus.PAID,
  PaymentStatus.PARTIALLY_REFUNDED,
];

/**
 * Returns (مرتجع ضريبي): the money, stock and email around a credit note.
 *
 * 1. CreditNoteService.reserve: the lines are reserved (awaiting_refund).
 * 2. The money: refunded through Moyasar (paid online), recorded on the order
 *    (paid by COD/transfer: refunded by hand), or already refunded (Moyasar
 *    dashboard). A failed refund voids the note.
 * 3. Issued: numbered, its lines restocked (stock +, sold −), the customer
 *    emailed with its PDF.
 *
 * The reason decides who pays the shipping (credit-note.calculator.ts):
 * `defect` gives back the returned lines' shipping, `other` keeps their
 * return shipping back from the refund. Both are priced here, like checkout
 * prices shipping (returnShipping).
 */
@Injectable()
export class OrderCreditNoteService {
  private readonly logger = new Logger(OrderCreditNoteService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly creditNoteService: CreditNoteService,
    private readonly paymentRefundService: PaymentRefundService,
    private readonly productHelperService: ProductHelperService,
    private readonly orderEmailService: OrderEmailService,
    private readonly shippingRatesService: ShippingRatesService,
    private readonly settingsService: SettingsService,
  ) {}

  /** A return from the dashboard: the chosen lines and quantities. */
  async createFromAdmin(
    orderId: string,
    input: {
      lines: RequestedLine[];
      reason: string;
      reasonType: ReturnReasonType;
      restock: boolean;
      /** The customer's return request it settles, if any. */
      returnRequest?: Types.ObjectId;
    },
    admin: { id: string; email?: string },
  ): Promise<CreditNoteDocument> {
    const policy = await this.policyFor(orderId, input.lines, input.reasonType);
    const note = await this.creditNoteService.reserve(orderId, input.lines, {
      reason: input.reason,
      source: 'admin',
      restock: input.restock,
      policy,
      returnRequest: input.returnRequest,
      createdBy: admin.id,
    });
    // reserve() only returns null for lines: 'all' with nothing left
    if (!note) throw new Error('Nothing to return');

    let refund: CreditNoteRefund;
    try {
      refund = await this.refundMoney(orderId, note, input.reason, admin);
    } catch (err) {
      await this.creditNoteService.void(note._id, (err as Error).message);
      throw err;
    }
    return this.finalize(note, refund);
  }

  /**
   * A full refund made in the Moyasar dashboard (payment.refunded): a
   * credit note for everything not returned yet, with shipping and fees.
   * The money is already back. Idempotent per refund transaction. `note` is
   * null when nothing is left (returns already covered every line) or when
   * the order has no issued invoice (`invoiceIssued: false`: nothing can be
   * credited, so the caller restocks as before credit notes).
   */
  async createForFullRefund(
    orderId: string,
    transactionId: string,
    restock: boolean,
  ): Promise<{ note: CreditNoteDocument | null; invoiceIssued: boolean }> {
    const summary = await this.creditNoteService.summary(orderId);
    if (!summary.invoiceIssued) return { note: null, invoiceIssued: false };
    const note = await this.creditNoteService.reserve(orderId, 'all', {
      reason: 'استرداد كامل لمبلغ الطلب / Full refund',
      source: 'full_refund',
      restock,
      idempotencyKey: `full:${transactionId}`,
    });
    if (!note) return { note: null, invoiceIssued: true };
    return {
      note: await this.finalize(note, {
        via: 'already_refunded',
        amount: refundableAmount(note),
      }),
      invoiceIssued: true,
    };
  }

  /** Puts the money back, or records that it is already back. */
  private async refundMoney(
    orderId: string,
    note: CreditNoteDocument,
    reason: string,
    admin: { id: string; email?: string },
  ): Promise<CreditNoteRefund> {
    const summary = await this.creditNoteService.summary(orderId);
    // Less the return shipping kept back (`other`)
    const refundable = refundableAmount(note);
    const toRefund = cleanMoney(
      Math.max(0, refundable - summary.uncreditedRefund),
    );
    if (toRefund === 0) {
      return { via: 'already_refunded', amount: refundable };
    }

    const order = await this.orderModel
      .findById(orderId)
      .select('paymentMethodCode paymentStatus refundedAmount grandTotal')
      .lean();
    if (!order) throw new Error(`Order ${orderId} not found`);
    const paid = PAID_STATUSES.includes(order.paymentStatus);

    if (paid && order.paymentMethodCode === 'moyasar') {
      // Records the refund on the order and emails the customer about it
      // (payment.refunded)
      await this.paymentRefundService.refundOrder(
        orderId,
        { amount: toRefund, reason },
        admin,
      );
      return { via: 'moyasar', amount: toRefund };
    }
    if (paid) {
      // COD / bank transfer: the money goes back by hand; the order says so
      const refunded = cleanMoney((order.refundedAmount || 0) + toRefund);
      await this.orderModel.updateOne(
        { _id: orderId },
        {
          $set: {
            refundedAmount: refunded,
            refundedAt: new Date(),
            paymentStatus:
              refunded >= (order.grandTotal || 0)
                ? PaymentStatus.REFUNDED
                : PaymentStatus.PARTIALLY_REFUNDED,
          },
        },
      );
      return { via: 'manual', amount: toRefund };
    }
    // Not paid yet (e.g. COD before delivery): nothing to give back
    return { via: 'none', amount: 0 };
  }

  /** Numbers the credit note, restocks its lines, emails the customer. */
  private async finalize(
    reserved: CreditNoteDocument,
    refund: CreditNoteRefund,
  ): Promise<CreditNoteDocument> {
    const note = await this.creditNoteService.issue(reserved._id, refund);

    if (note.restock && !note.restocked) {
      try {
        await this.productHelperService.restockOrderItems(
          note.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          })),
          'deducted',
        );
        await this.creditNoteService.markRestocked(note._id);
      } catch (err) {
        // The credit note stands; the stock is corrected by hand
        this.logger.error(
          `Credit note ${note.displayNumber}: restocking failed: ${(err as Error).message}`,
        );
      }
    }

    try {
      await this.emailCustomer(note);
    } catch (err) {
      this.logger.error(
        `Credit note ${note.displayNumber}: customer email not queued: ${(err as Error).message}`,
      );
    }
    return note;
  }

  /**
   * Emails an issued credit note to the order's customer (the mail job
   * attaches its PDF): the one email of a return, and the dashboard's
   * "resend".
   *
   * @returns Whether it was queued (false: the customer has no email).
   */
  async emailCustomer(
    note: Pick<
      CreditNoteDocument,
      | '_id'
      | 'order'
      | 'displayNumber'
      | 'amounts'
      | 'deductions'
      | 'snapshot'
      | 'refund'
    >,
  ): Promise<boolean> {
    const order = await this.orderModel
      .findById(note.order)
      .select('user invoiceNumber currency')
      .lean();
    const user = order
      ? await this.userModel.findById(order.user).select('email name').lean()
      : null;
    if (!order || !user?.email) return false;
    await this.orderEmailService.sendCreditNoteEmail(
      {
        _id: note._id,
        displayNumber: note.displayNumber,
        total: note.amounts.total,
        returnShipping: note.deductions?.returnShipping?.total ?? 0,
        // As printed on the credit note: the amount kept back and why
        deductionNote: note.snapshot?.summary?.deductionNote,
        deductionNoteEn: note.snapshot?.summary?.deductionNoteEn,
        refund: note.refund,
      },
      order,
      { email: user.email, name: user.name },
    );
    return true;
  }

  /**
   * The dashboard's "resend": the issued credit note emailed again.
   *
   * @throws {NotFoundException} No issued credit note with this id.
   * @throws {BadRequestException} The customer has no email.
   */
  async resendEmail(noteId: string): Promise<void> {
    const note = await this.creditNoteService.findIssued(noteId);
    if (!note) throw new NotFoundException('Credit note not found');
    if (!(await this.emailCustomer(note))) {
      throw new BadRequestException('The customer has no email address');
    }
  }

  /**
   * True when the order's credit notes account for `refundedAmount` (the
   * cumulative refund): the refund is then told in the credit note email.
   * A note still awaiting its refund counts: it is the one refunding now.
   */
  async coversRefund(
    orderId: string,
    refundedAmount: number,
  ): Promise<boolean> {
    const notes = await this.list(orderId);
    const credited = notes
      .filter((n) => n.state === 'awaiting_refund' || n.refund?.via !== 'none')
      .reduce((sum, n) => sum + refundableAmount(n), 0);
    // Within half the smallest unit of a 3-decimal currency
    return refundedAmount <= cleanMoney(credited) + 0.0005;
  }

  /**
   * The amounts a return would have (the dashboard's and the customer's
   * preview), with the returned lines' shipping priced for the reason.
   */
  async preview(
    orderId: string,
    lines: RequestedLine[],
    reasonType: ReturnReasonType,
  ) {
    return this.creditNoteService.preview(
      orderId,
      lines,
      await this.policyFor(orderId, lines, reasonType),
    );
  }

  /** The reason with its lines' shipping (see returnShipping). */
  private async policyFor(
    orderId: string,
    lines: RequestedLine[],
    reasonType: ReturnReasonType,
  ): Promise<ReturnPolicyInput> {
    return {
      reasonType,
      returnShipping: await this.returnShipping(orderId, lines, reasonType),
    };
  }

  /**
   * The shipping of the returned lines: their weight to the order's
   * address, priced as checkout prices it (ShippingRatesService:
   * calculateShipping, then selectShippingOption on the order's provider).
   * - `defect`: the shipping to give back. calculateShippingCost applies the
   *   store's free-shipping threshold on the order's subtotal after its
   *   coupon; an order that paid no shipping needs none.
   * - `other`: the return shipping the customer pays, even when the order
   *   shipped free: priced with a subtotal of 0 (no rate's free-shipping
   *   threshold is reached) and without the store's threshold.
   * Rates are today's, not the purchase's.
   *
   * @throws {BadRequestException} No shipping rate covers the address now.
   */
  private async returnShipping(
    orderId: string,
    lines: RequestedLine[],
    reasonType: ReturnReasonType,
  ): Promise<number> {
    const order = await this.orderModel
      .findById(orderId)
      .select(
        'items.weight items.variantId shippingAddress shippingProviderId shippingAmount totalPrice discountAmount currency',
      )
      .populate({ path: 'items.variantId', select: 'shippingProfile' })
      .lean();
    if (!order) return 0;
    if (reasonType === 'defect' && !((order.shippingAmount ?? 0) > 0)) {
      return 0;
    }
    const address = order.shippingAddress;
    if (!address?.city || lines.length === 0) return 0;

    // Weight per unit (kg) frozen on the line; older lines: the variant's profile
    const weight = lines.reduce((sum, { itemIndex, quantity }) => {
      const item = order.items[itemIndex];
      const profile = (
        item?.variantId as unknown as {
          shippingProfile?: { weightGrams?: number };
        } | null
      )?.shippingProfile;
      const perUnit =
        item?.weight || UnitConverter.gramsToKg(profile?.weightGrams ?? 0);
      return sum + perUnit * quantity;
    }, 0);
    const subtotalAfterDiscount = cleanMoney(
      (order.totalPrice || 0) - (order.discountAmount || 0),
    );

    // The customer pays the return shipping: no free-shipping threshold
    const customerPays = reasonType === 'other';

    try {
      const options = await this.shippingRatesService.calculateShipping(
        address.city.toString(),
        weight,
        customerPays ? 0 : subtotalAfterDiscount,
        address.country?.toString(),
        address.region?.toString(),
        order.currency,
      );
      const chosen = this.shippingRatesService.selectShippingOption(
        options,
        order.shippingProviderId?.toString() ?? '',
      );
      if (customerPays) return chosen.totalShippingCost;
      return this.shippingRatesService.calculateShippingCost(
        chosen,
        subtotalAfterDiscount,
        await this.settingsService.getSettings(),
      );
    } catch (err) {
      throw new BadRequestException(
        `The return shipping cannot be priced: ${(err as Error).message}`,
      );
    }
  }

  /** For the order pages: the order's credit notes. */
  list(orderId: string) {
    if (!Types.ObjectId.isValid(orderId)) return Promise.resolve([]);
    return this.creditNoteService.listForOrder(orderId);
  }
}
