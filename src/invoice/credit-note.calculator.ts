import { Types } from 'mongoose';
import {
  calculateTaxOnAmount,
  extractTaxFromAmount,
} from 'src/taxes/shared/utils/tax-calculation.util';
import {
  cleanMoney,
  roundMoney,
} from 'src/payments/shared/utils/currency.util';
import type {
  CreditNoteAmounts,
  CreditNoteDeductions,
  CreditNoteLine,
} from './schemas/credit-note.schema';

/**
 * What a credit note refunds, from the order's frozen numbers (the same rules
 * as checkout: taxes/taxes.service.ts calculateTax). Pure: no database.
 *
 * - Each returned line counts at its invoice price × returned quantity.
 * - Coupon: each line gives back its own share of the discount, frozen at
 *   checkout (`items[].discount`: 0 on lines the coupon did not cover), in
 *   proportion to the quantity returned; the return that empties a line takes
 *   what is left of its share. Orders from before that snapshot use
 *   `lineDiscounts` (the credit note service's estimate from the coupon), or
 *   else share the order's discount in proportion to the lines' value (exact
 *   for a coupon on the whole order).
 * - VAT follows the order's rate and mode (taxesIncluded) at purchase time.
 * - The reason (`reasonType`) decides who pays the shipping:
 *   - `defect` (defect or store error, the store pays): a partial return
 *     also gives back the shipping of the returned lines' weight
 *     (`returnShipping`, at most what is left of the shipping paid); the
 *     return that empties the order gives back everything left, payment
 *     fees included, and takes the invoice's remainder (total and VAT), so
 *     those credit notes add up to the invoice to the halala.
 *   - `other` (e.g. a change of mind, the customer pays): products and
 *     their VAT only, no shipping or fees; `returnShipping` (with VAT when
 *     applyTaxOnCharges) is deducted from the money refunded
 *     (`deductions`), not from the credit note. The last one takes the
 *     remainder of the invoice's products part.
 * - Charges carry VAT when applyTaxOnCharges, as at checkout.
 */

export interface CreditOrderInput {
  items: {
    productId: Types.ObjectId | { _id: Types.ObjectId } | string;
    variantId: Types.ObjectId | { _id: Types.ObjectId } | string;
    price?: number;
    quantity?: number;
    /** The line's share of the coupon, frozen at checkout (newer orders). */
    discount?: number;
  }[];
  /** Older orders: each line's estimated coupon share (by line index). */
  lineDiscounts?: number[];
  totalPrice?: number;
  discountAmount?: number;
  shippingAmount?: number;
  paymentFees?: number;
  taxPercentage?: number;
  taxesIncluded?: boolean;
  applyTaxOnCharges?: boolean;
  /** The order's currency: every amount rounds to its smallest unit. */
  currency?: string;
}

/** The issued invoice's totals (its frozen snapshot amounts). */
export interface InvoiceTotals {
  grandTotal: number;
  tax: number;
}

/** Credit notes already issued or in progress (not void). */
export interface PriorCreditNote {
  lines: { itemIndex: number; quantity: number }[];
  amounts: Pick<CreditNoteAmounts, 'total' | 'tax'> &
    Partial<Pick<CreditNoteAmounts, 'shipping' | 'paymentFees' | 'chargesTax'>>;
}

/**
 * Why the items come back: `defect` (defect or store error: the store pays
 * the shipping) or `other` (e.g. a change of mind: the customer pays it).
 */
export type ReturnReasonType = 'defect' | 'other';

/** How the return is priced beyond its lines (see the top of this file). */
export interface ReturnPolicyInput {
  reasonType: ReturnReasonType;
  /**
   * Shipping for the returned lines' weight to the order's address, as
   * checkout prices it (0 when the order reached free shipping).
   */
  returnShipping: number;
}

export interface RequestedLine {
  itemIndex: number;
  quantity: number;
}

export interface CreditNoteCalculation {
  lines: CreditNoteLine[];
  amounts: CreditNoteAmounts;
  includesCharges: boolean;
  /** Kept back from the refund (`other`: the return shipping). */
  deductions: CreditNoteDeductions;
  /** What goes back to the customer: the total less the deductions. */
  refundAmount: number;
}

export class CreditNoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreditNoteError';
  }
}

/** Before an order stored its rate, its invoice estimated 15 % VAT. */
const LEGACY_TAX_PERCENTAGE = 15;

/**
 * The money a credit note gives back: its total less what is kept back
 * (`other` returns: the return shipping).
 */
export const refundableAmount = (note: {
  amounts: { total: number };
  deductions?: CreditNoteDeductions;
}): number =>
  cleanMoney(
    note.amounts.total - (note.deductions?.returnShipping?.total ?? 0),
  );

/** The id of an order line's product/variant, populated or not. */
const idOf = (ref: CreditOrderInput['items'][number]['productId']) =>
  new Types.ObjectId(
    typeof ref === 'object' && '_id' in ref ? String(ref._id) : String(ref),
  );

/**
 * The coupon discount `quantity` returned units of a line give back. With a
 * per-line share (frozen, or estimated for old orders): that share in
 * proportion to the quantity, the return that empties the line taking what
 * is left of it. Without one: the order's discount in proportion to value.
 */
function lineDiscountShare(
  order: CreditOrderInput,
  prior: PriorCreditNote[],
  itemIndex: number,
  quantity: number,
): number {
  const item = order.items[itemIndex];
  const hasLineShares =
    order.items.some((i) => i.discount !== undefined) || !!order.lineDiscounts;

  if (!hasLineShares) {
    const subtotal = order.totalPrice || 0;
    const gross = (item.price || 0) * quantity;
    return subtotal > 0 ? ((order.discountAmount || 0) * gross) / subtotal : 0;
  }

  const lineShare = item.discount ?? order.lineDiscounts?.[itemIndex] ?? 0;
  const sold = item.quantity || 1;
  const priorQuantities = prior.flatMap((note) =>
    note.lines.filter((l) => l.itemIndex === itemIndex).map((l) => l.quantity),
  );
  const returnedBefore = priorQuantities.reduce((sum, q) => sum + q, 0);
  if (returnedBefore + quantity >= sold) {
    // Empties the line: exactly what earlier returns of it left
    const given = priorQuantities.reduce(
      (sum, q) => sum + roundMoney((lineShare * q) / sold, order.currency),
      0,
    );
    return roundMoney(lineShare - given, order.currency);
  }
  return roundMoney((lineShare * quantity) / sold, order.currency);
}

/** Per order line, how many can still be returned. */
export function remainingQuantities(
  order: CreditOrderInput,
  prior: PriorCreditNote[],
): number[] {
  const remaining = order.items.map((item) => item.quantity || 1);
  for (const note of prior) {
    for (const line of note.lines) {
      if (remaining[line.itemIndex] !== undefined) {
        remaining[line.itemIndex] -= line.quantity;
      }
    }
  }
  return remaining.map((n) => Math.max(0, n));
}

/** Every line still returnable, in full (a full refund). */
export function allRemainingLines(
  order: CreditOrderInput,
  prior: PriorCreditNote[],
): RequestedLine[] {
  return remainingQuantities(order, prior)
    .map((quantity, itemIndex) => ({ itemIndex, quantity }))
    .filter((line) => line.quantity > 0);
}

/**
 * The credit note for `requested` lines: validates them against what is left
 * to return (after `prior` credit notes), then prices them (see the rules at
 * the top of this file).
 *
 * @param invoice The issued invoice's totals: the last credit note takes
 *   their remainder.
 * @param policy The reason and the returned lines' shipping. Without it: a
 *   defect return with no shipping priced for its lines.
 * @throws {CreditNoteError} No line, an unknown or repeated line, a quantity
 *   that is not a whole number ≥ 1, or more than is left to return.
 */
export function calculateCreditNote(
  order: CreditOrderInput,
  invoice: InvoiceTotals,
  prior: PriorCreditNote[],
  requested: RequestedLine[],
  policy: ReturnPolicyInput = { reasonType: 'defect', returnShipping: 0 },
): CreditNoteCalculation {
  if (requested.length === 0) {
    throw new CreditNoteError('Choose at least one line to return');
  }
  const remaining = remainingQuantities(order, prior);
  const seen = new Set<number>();
  for (const { itemIndex, quantity } of requested) {
    if (!Number.isInteger(itemIndex) || !order.items[itemIndex]) {
      throw new CreditNoteError(`Unknown order line ${itemIndex}`);
    }
    if (seen.has(itemIndex)) {
      throw new CreditNoteError(`Line ${itemIndex + 1} is listed twice`);
    }
    seen.add(itemIndex);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new CreditNoteError(
        `Line ${itemIndex + 1}: the quantity must be a whole number of at least 1`,
      );
    }
    if (quantity > remaining[itemIndex]) {
      throw new CreditNoteError(
        `Line ${itemIndex + 1}: only ${remaining[itemIndex]} left to return`,
      );
    }
  }

  const pct = order.taxPercentage ?? LEGACY_TAX_PERCENTAGE;
  // Every amount in the order's currency's smallest unit (2 or 3 decimals)
  const round = (value: number) => roundMoney(value, order.currency);
  let products = 0;
  let discount = 0;
  for (const { itemIndex, quantity } of requested) {
    products += (order.items[itemIndex].price || 0) * quantity;
    discount += lineDiscountShare(order, prior, itemIndex, quantity);
  }
  products = round(products);
  discount = round(discount);
  const net = round(products - discount);

  const productsTax = order.taxesIncluded
    ? extractTaxFromAmount(net, pct, order.currency)
    : calculateTaxOnAmount(net, pct, order.currency);
  const productsBeforeTax = order.taxesIncluded
    ? round(net - productsTax)
    : net;

  // This credit note returns everything left
  const completes = remaining.every(
    (left, i) =>
      left === (requested.find((r) => r.itemIndex === i)?.quantity ?? 0),
  );
  const chargesTaxOn = (amount: number) =>
    order.applyTaxOnCharges
      ? calculateTaxOnAmount(amount, pct, order.currency)
      : 0;
  const sum = (pick: (n: PriorCreditNote['amounts']) => number) =>
    prior.reduce((total, n) => total + pick(n.amounts), 0);
  // Earlier notes' charges; older ones did not store their VAT
  const shippingLeft = Math.max(
    0,
    round((order.shippingAmount || 0) - sum((a) => a.shipping || 0)),
  );
  const feesLeft = Math.max(
    0,
    round((order.paymentFees || 0) - sum((a) => a.paymentFees || 0)),
  );
  const chargesTaxLeft = Math.max(
    0,
    round(
      chargesTaxOn((order.shippingAmount || 0) + (order.paymentFees || 0)) -
        sum(
          (a) =>
            a.chargesTax ??
            chargesTaxOn((a.shipping || 0) + (a.paymentFees || 0)),
        ),
    ),
  );

  const defect = policy.reasonType === 'defect';
  const shipping = !defect
    ? 0
    : completes
      ? shippingLeft
      : Math.min(round(policy.returnShipping), shippingLeft);
  const paymentFees = defect && completes ? feesLeft : 0;
  const chargesTax = chargesTaxOn(shipping + paymentFees);

  let tax = round(productsTax + chargesTax);
  let total = round(productsBeforeTax + shipping + paymentFees + tax);
  if (completes) {
    // The invoice's remainder: no rounding drift across several credit
    // notes. `other` leaves the charges not refunded yet on the invoice.
    const keptCharges = defect ? 0 : shippingLeft + feesLeft + chargesTaxLeft;
    const keptTax = defect ? 0 : chargesTaxLeft;
    total = round(invoice.grandTotal - sum((a) => a.total) - keptCharges);
    tax = round(invoice.tax - sum((a) => a.tax) - keptTax);
  }
  const taxable = round(total - tax);
  const productsAfterTax = round(total - shipping - paymentFees - chargesTax);

  // `other`: the customer pays the return shipping, out of the refund
  const returnShipping = defect ? 0 : round(policy.returnShipping);
  const returnShippingTax = chargesTaxOn(returnShipping);
  const deducted = Math.min(round(returnShipping + returnShippingTax), total);
  const deductions: CreditNoteDeductions =
    deducted > 0
      ? {
          returnShipping: {
            amount: round(deducted - Math.min(returnShippingTax, deducted)),
            tax: Math.min(returnShippingTax, deducted),
            total: deducted,
          },
        }
      : {};

  return {
    lines: requested.map(({ itemIndex, quantity }) => ({
      itemIndex,
      quantity,
      productId: idOf(order.items[itemIndex].productId),
      variantId: idOf(order.items[itemIndex].variantId),
    })),
    includesCharges: completes && defect,
    deductions,
    refundAmount: round(total - deducted),
    amounts: {
      products,
      discount,
      productsBeforeTax: completes
        ? round(taxable - shipping - paymentFees)
        : productsBeforeTax,
      productsAfterTax,
      shipping,
      paymentFees,
      chargesTax,
      taxable,
      tax,
      total,
    },
  };
}
