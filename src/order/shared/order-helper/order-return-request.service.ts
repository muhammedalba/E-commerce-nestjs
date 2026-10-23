import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { User } from 'src/auth/shared/schema/user.schema';
import { CreditNoteService } from 'src/invoice/credit-note.service';
import {
  RequestedLine,
  ReturnReasonType,
} from 'src/invoice/credit-note.calculator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { Role } from 'src/roles/shared/schemas/role.schema';
import { SettingsService } from 'src/settings/settings.service';
import { OrderStatus } from '../enums/order-status.enum';
import { Order } from '../schemas/Order.schema';
import {
  ReturnRequest,
  ReturnRequestDocument,
  ReturnRequestStatus,
} from '../schemas/return-request.schema';
import { OrderCreditNoteService } from './order-credit-note.service';
import { OrderEmailService } from './order-email.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Long enough for a Moyasar refund; a crashed approval frees it after. */
const APPROVAL_LEASE_MS = 5 * 60 * 1000;

/** Orders the customer has received: the only ones a request can return. */
const RECEIVED: string[] = [OrderStatus.DELIVERED, OrderStatus.COMPLETED];

/** Whether the customer may still ask for a return, and until when. */
export interface ReturnPolicy {
  /** The store setting `returnWindowDays`. */
  windowDays: number;
  /** Delivery + the window; null before delivery. */
  endsAt: Date | null;
  /** Received, and the window has not ended. */
  open: boolean;
}

/**
 * Customer return requests: the customer asks (within the return window,
 * `returnWindowDays` in the store settings, after delivery, for a defect or other reasons), the admins are notified,
 * and an admin approves it, which issues the credit note and refunds
 * (OrderCreditNoteService.createFromAdmin, with the request's reason), or
 * rejects it with a reason emailed to the customer.
 */
@Injectable()
export class OrderReturnRequestService {
  private readonly logger = new Logger(OrderReturnRequestService.name);

  constructor(
    @InjectModel(ReturnRequest.name)
    private readonly returnRequestModel: Model<ReturnRequest>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    private readonly creditNoteService: CreditNoteService,
    private readonly orderCreditNoteService: OrderCreditNoteService,
    private readonly orderEmailService: OrderEmailService,
    private readonly settingsService: SettingsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * The return window, in days after delivery: the store setting
   * `returnWindowDays` (cached with the settings; 5 until one is saved).
   */
  async windowDays(): Promise<number> {
    const settings = await this.settingsService.getSettings();
    return settings.returnWindowDays ?? 5;
  }

  /**
   * The return window of an order: open from delivery for `windowDays`
   * (orders delivered before `deliveredAt` was recorded: from completion).
   */
  policyFor(
    order: {
      status?: string;
      deliveredAt?: Date | null;
      completedAt?: Date | null;
    },
    windowDays: number,
  ): ReturnPolicy {
    const received = order.deliveredAt ?? order.completedAt;
    const endsAt =
      received && RECEIVED.includes(order.status ?? '')
        ? new Date(new Date(received).getTime() + windowDays * DAY_MS)
        : null;
    return {
      windowDays,
      endsAt,
      open: !!endsAt && windowDays > 0 && Date.now() <= endsAt.getTime(),
    };
  }

  /**
   * How many of each line the customer can still ask to return (sold less
   * credited or being credited); none before the invoice is issued.
   */
  async returnable(orderId: string): Promise<number[]> {
    const summary = await this.creditNoteService.summary(orderId);
    return summary.invoiceIssued ? summary.remaining : [];
  }

  /** The order's requests, newest first. */
  listForOrder(orderId: string) {
    return this.returnRequestModel
      .find({ order: new Types.ObjectId(orderId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  /** The dashboard's list, newest first, with each order's number and total. */
  async list(query: {
    status?: ReturnRequestStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const filter = query.status ? { status: query.status } : {};
    const [data, total] = await Promise.all([
      this.returnRequestModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate([
          {
            path: 'order',
            select:
              'invoiceNumber grandTotal currency status paymentMethodCode',
          },
          { path: 'user', select: 'name email phone' },
        ])
        .lean(),
      this.returnRequestModel.countDocuments(filter),
    ]);
    // The paginated shape the response interceptor turns into `meta`
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

  /**
   * What the customer would get back for these lines and reason (nothing is
   * saved): the same amounts the admin sees.
   */
  async previewForCustomer(
    userId: string,
    orderId: string,
    input: { lines: RequestedLine[]; reasonType: ReturnReasonType },
  ) {
    const order = await this.customerOrder(userId, orderId);
    await this.assertWindowOpen(order);
    const preview = await this.orderCreditNoteService.preview(
      orderId,
      input.lines,
      input.reasonType,
    );
    return {
      amounts: preview.amounts,
      deductions: preview.deductions,
      refundAmount: preview.refundAmount,
      includesCharges: preview.includesCharges,
    };
  }

  /**
   * The customer's request: their own order, received, within the window,
   * its invoice issued, at most what is left of each line, and no other
   * request waiting. Notifies the admins who can refund.
   *
   * @throws {BadRequestException} Window closed, not received, or lines
   *   beyond what is left.
   * @throws {ConflictException} A request for this order is already pending.
   */
  async create(
    userId: string,
    orderId: string,
    input: {
      lines: RequestedLine[];
      reasonType: ReturnReasonType;
      note: string;
    },
  ): Promise<ReturnRequestDocument> {
    const order = await this.customerOrder(userId, orderId);
    await this.assertWindowOpen(order);

    const summary = await this.creditNoteService.summary(orderId);
    if (!summary.invoiceIssued) {
      throw new BadRequestException('This order has no tax invoice yet');
    }
    const seen = new Set<number>();
    for (const { itemIndex, quantity } of input.lines) {
      if (seen.has(itemIndex)) {
        throw new BadRequestException(`Line ${itemIndex + 1} is listed twice`);
      }
      seen.add(itemIndex);
      if (quantity > (summary.remaining[itemIndex] ?? 0)) {
        throw new BadRequestException(
          `Line ${itemIndex + 1}: only ${summary.remaining[itemIndex] ?? 0} left to return`,
        );
      }
    }

    let request: ReturnRequestDocument;
    try {
      request = await this.returnRequestModel.create({
        order: order._id,
        user: new Types.ObjectId(userId),
        lines: input.lines.map(({ itemIndex, quantity }) => ({
          itemIndex,
          quantity,
        })),
        reasonType: input.reasonType,
        note: input.note,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException(
          'A return request for this order is already waiting for review',
        );
      }
      throw err;
    }
    await this.notifyAdmins(order, request);
    return request;
  }

  /** The customer withdraws a request nobody decided yet. */
  async cancel(userId: string, orderId: string, requestId: string) {
    await this.customerOrder(userId, orderId);
    const request = await this.returnRequestModel.findOneAndUpdate(
      {
        _id: requestId,
        order: new Types.ObjectId(orderId),
        status: 'pending',
      },
      { $set: { status: 'cancelled', decidedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!request) {
      throw new NotFoundException('No pending return request to cancel');
    }
    return request;
  }

  /**
   * Approves a pending request: issues its credit note with the request's
   * reason (the admin may change the quantities), which refunds and
   * restocks. The request is approved only once the credit note is issued;
   * a failed refund leaves it pending.
   */
  async approve(
    orderId: string,
    requestId: string,
    input: { lines?: RequestedLine[]; restock?: boolean },
    admin: { id: string; email?: string },
  ) {
    const request = await this.claim(orderId, requestId);
    let note: Awaited<ReturnType<OrderCreditNoteService['createFromAdmin']>>;
    try {
      note = await this.orderCreditNoteService.createFromAdmin(
        orderId,
        {
          lines: input.lines?.length ? input.lines : request.lines,
          reason: request.note,
          reasonType: request.reasonType,
          restock: input.restock ?? true,
          returnRequest: request._id,
        },
        admin,
      );
    } catch (err) {
      // Still pending: the admin can try again
      await this.returnRequestModel.updateOne(
        { _id: request._id },
        { $unset: { processingUntil: 1 } },
      );
      throw err;
    }
    await this.returnRequestModel.updateOne(
      { _id: request._id },
      {
        $unset: { processingUntil: 1 },
        $set: {
          status: 'approved',
          decidedBy: new Types.ObjectId(admin.id),
          decidedAt: new Date(),
          creditNote: note._id,
        },
      },
    );
    return note;
  }

  /** Rejects a pending request and emails the customer the reason. */
  async reject(
    orderId: string,
    requestId: string,
    reason: string,
    admin: { id: string },
  ) {
    const request = await this.returnRequestModel.findOneAndUpdate(
      {
        _id: requestId,
        order: new Types.ObjectId(orderId),
        status: 'pending',
        // Not while an approval is refunding it
        $or: [
          { processingUntil: { $exists: false } },
          { processingUntil: { $lt: new Date() } },
        ],
      },
      {
        $set: {
          status: 'rejected',
          rejectionReason: reason,
          decidedBy: new Types.ObjectId(admin.id),
          decidedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );
    if (!request) throw new NotFoundException('No pending return request');

    const [order, user] = await Promise.all([
      this.orderModel.findById(orderId).select('invoiceNumber').lean(),
      this.userModel.findById(request.user).select('email name').lean(),
    ]);
    if (order && user?.email) {
      await this.orderEmailService.sendReturnRejectedEmail(
        order,
        { email: user.email, name: user.name },
        reason,
      );
    }
    return request;
  }

  /**
   * Takes a pending request for approval (a lease of APPROVAL_LEASE_MS), so
   * two admins approving it at once never issue two credit notes.
   *
   * @throws {NotFoundException} No such pending request.
   * @throws {ConflictException} Another approval is running.
   */
  private async claim(orderId: string, requestId: string) {
    const now = new Date();
    const filter = {
      _id: requestId,
      order: new Types.ObjectId(orderId),
      status: 'pending',
    } as QueryFilter<ReturnRequest>;
    const request = await this.returnRequestModel
      .findOneAndUpdate(
        {
          ...filter,
          $or: [
            { processingUntil: { $exists: false } },
            { processingUntil: { $lt: now } },
          ],
        },
        {
          $set: {
            processingUntil: new Date(now.getTime() + APPROVAL_LEASE_MS),
          },
        },
        { returnDocument: 'after' },
      )
      .lean();
    if (request) return request;
    if (await this.returnRequestModel.exists(filter)) {
      throw new ConflictException('This return request is being approved');
    }
    throw new NotFoundException('No pending return request');
  }

  /** The customer's own order, or 404 (another customer's is not found). */
  private async customerOrder(userId: string, orderId: string) {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Invalid order ID');
    }
    const order = await this.orderModel
      .findOne({ _id: orderId, user: new Types.ObjectId(userId) })
      .select('status deliveredAt completedAt invoiceNumber')
      .lean();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** @throws {BadRequestException} Not received yet, or the window ended. */
  private async assertWindowOpen(order: Parameters<typeof this.policyFor>[0]) {
    const policy = this.policyFor(order, await this.windowDays());
    if (!policy.endsAt) {
      throw new BadRequestException(
        'A return can be requested once the order is delivered',
      );
    }
    if (!policy.open) {
      throw new BadRequestException(
        `The return period (${policy.windowDays} days after delivery) has ended`,
      );
    }
  }

  /**
   * Tells the roles that can refund (REFUND_ORDER) about a new request:
   * persisted and streamed to the dashboard like the payment reviews.
   * Never throws: the request is saved either way.
   */
  private async notifyAdmins(
    order: { _id: Types.ObjectId; invoiceNumber?: number | null },
    request: ReturnRequestDocument,
  ) {
    try {
      const roles = await this.roleModel
        .find({ permissions: Permissions.REFUND_ORDER })
        .select('_id')
        .lean();
      const number =
        order.invoiceNumber != null
          ? String(order.invoiceNumber).padStart(4, '0')
          : order._id.toString().slice(-6).toUpperCase();
      const defect = request.reasonType === 'defect';
      for (const role of roles) {
        this.eventEmitter.emit(`role.notification.${role._id.toString()}`, {
          roleId: role._id.toString(),
          action: 'return_requested',
          message: {
            ar: `طلب إرجاع جديد للطلب ${number} (${defect ? 'عيب في المنتج' : 'أسباب أخرى'}). راجعه من صفحة الطلب.`,
            en: `New return request for order ${number} (${defect ? 'defective product' : 'other reasons'}). Review it on the order page.`,
          },
          payload: {
            orderId: order._id.toString(),
            returnRequestId: request._id.toString(),
          },
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to notify admins about return request ${request._id.toString()}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
