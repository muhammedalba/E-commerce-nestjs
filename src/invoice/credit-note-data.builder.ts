import {
  invoiceItemRow,
  InvoiceOrderInput,
  InvoiceSnapshot,
} from './invoice-data.builder';
import type {
  CreditNoteAmounts,
  CreditNoteDeductions,
  CreditNoteLine,
} from './schemas/credit-note.schema';
import { cleanMoney } from 'src/payments/shared/utils/currency.util';
import { amountToArabicWords } from './utils/arabic-amount-words';
import { formatInvoiceCurrency } from './utils/invoice-currency';
import { buildZatcaTlvBase64, ZatcaFields } from './utils/zatca-tlv';

/** The credit note's number, e.g. RUH-R-8-2026-0121 (invoices: RUH-8-…). */
export function creditNoteDisplayNumber(
  serial: number,
  issuedAt: Date,
  timezone: string,
): string {
  const year = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: timezone,
  }).format(issuedAt);
  return `RUH-R-8-${year}-${String(serial).padStart(4, '0')}`;
}

/**
 * The return shipping kept back, stated in words on the credit note (and in
 * its email): the amount, its VAT when there is any, the reason (a return
 * for other reasons than a defect: the customer pays it) and the net refund.
 */
export function deductionNotes(
  deduction: { amount: number; tax: number; total: number },
  net: number,
  money: (amount: number) => string,
): { deductionNote: string; deductionNoteEn: string } {
  const vatAr =
    deduction.tax > 0
      ? ` (${money(deduction.amount)} + ضريبة ${money(deduction.tax)})`
      : '';
  const vatEn =
    deduction.tax > 0
      ? ` (${money(deduction.amount)} + VAT ${money(deduction.tax)})`
      : '';
  return {
    deductionNote: `خُصم من المبلغ المسترد ${money(deduction.total)} تكلفة الشحن العكسي${vatAr}، لأن الإرجاع لأسباب أخرى غير العيب ويتحمّلها العميل وفق سياسة الإرجاع. صافي المبلغ المسترد: ${money(net)}.`,
    deductionNoteEn: `Return shipping of ${money(deduction.total)}${vatEn} was deducted from the refund: the items came back for reasons other than a defect, and the customer pays it under the return policy. Net refund: ${money(net)}.`,
  };
}

/**
 * What the credit note PDF shows: the invoice it reverses, as frozen on that
 * invoice (store, customer, addresses, bank, logo), with its own number and
 * date, the returned lines only, and its amounts. Same template as the
 * invoice (`kind: 'credit_note'`).
 */
export function buildCreditNoteSnapshot(params: {
  invoice: { displayNumber: string; snapshot: InvoiceSnapshot };
  order: InvoiceOrderInput;
  note: {
    displayNumber: string;
    issuedAt: Date;
    lines: CreditNoteLine[];
    amounts: CreditNoteAmounts;
    /** Absent on credit notes from before the return policy. */
    reasonType?: 'defect' | 'other';
    deductions?: CreditNoteDeductions;
  };
  timezone: string;
}): InvoiceSnapshot {
  const { invoice, order, note, timezone } = params;
  const base = invoice.snapshot;
  // In the invoice's currency, formatted as on the invoice
  const money = (amount: number) =>
    formatInvoiceCurrency(amount, base.currencyCode);
  const a = note.amounts;
  const deduction = note.deductions?.returnShipping;
  const kept = deduction?.total ?? 0;
  const net = cleanMoney(a.total - kept);

  const zatca: ZatcaFields = {
    sellerName: base.header.siteNameAr,
    vatNumber: base.header.vatNo,
    invoiceDateTime: note.issuedAt.toISOString(),
    totalWithVat: a.total.toFixed(2),
    vatAmount: a.tax.toFixed(2),
  };

  return {
    ...base,
    version: 1,
    kind: 'credit_note',
    displayNumber: note.displayNumber,
    issuedAt: note.issuedAt.toISOString(),
    meta: {
      date: new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: timezone,
      }).format(note.issuedAt),
      number: note.displayNumber,
      placeOfDelivery: base.meta.placeOfDelivery,
      // Like the store's own credit notes: the invoice it reverses
      description: `رقم الفاتورة : ${invoice.displayNumber} # تاريخ الفاتورة : ${base.meta.date}`,
      ...(note.reasonType && {
        returnReason:
          note.reasonType === 'defect'
            ? 'عيب أو خلل في المنتج / Defective product'
            : 'أسباب أخرى / Other reasons',
      }),
    },
    items: note.lines.map((line, i) =>
      invoiceItemRow(
        (order.items ?? [])[line.itemIndex] ?? {},
        i + 1,
        money,
        line.quantity,
      ),
    ),
    summary: {
      subtotal: money(a.products),
      discount: money(a.discount),
      productsBeforeTax: money(a.productsBeforeTax),
      productsAfterTax: money(a.productsAfterTax),
      shipping: money(a.shipping),
      paymentFees: money(a.paymentFees),
      taxableSubtotal: money(a.taxable),
      tax: money(a.tax),
      grandTotal: money(a.total),
      amountWords: amountToArabicWords(
        a.total,
        order.currency || base.currencyCode,
      ),
      ...(deduction &&
        kept > 0 && {
          returnShipping: money(kept),
          netRefund: money(net),
          ...deductionNotes(deduction, net, money),
        }),
    },
    qr: { payload: buildZatcaTlvBase64(zatca), fields: zatca },
    footer: {
      ...base.footer,
      printedOn: new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        timeZone: timezone,
      }).format(note.issuedAt),
    },
    amounts: {
      subtotal: a.products,
      discount: a.discount,
      shipping: a.shipping,
      paymentFees: a.paymentFees,
      taxableSubtotal: a.taxable,
      tax: a.tax,
      grandTotal: a.total,
      productsBeforeTax: a.productsBeforeTax,
      productsAfterTax: a.productsAfterTax,
    },
  };
}
