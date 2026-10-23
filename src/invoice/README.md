# Tax invoice (PDF)

The order's tax invoice is issued **when the order is paid**, stored, and
emailed to the customer:

- **Moyasar**: paid before it is confirmed (`payment.succeeded`), so the
  order-confirmation email carries the invoice.
- **COD, bank transfer**: confirmed when created, with no invoice yet. When an
  admin sets the payment status to PAID (`PATCH /order/:id`), a "payment
  received" email carries it (`payment-received-customer`). It is sent once:
  the job sends nothing if the invoice already went out attached.

The invoice is dated on payment (`paidAt`; paid orders from before that field:
created). Its number stays the order's: `RUH-8-{order year}-{invoiceNumber}`,
so orders never paid leave gaps in the invoice series. The invoice is also
shown on the order (`InvoicePdf`): as an iframe in the dashboard, and as
"download invoice" on the customer's order page.

No browser is involved. The PDF is typeset by [Typst](https://typst.app), in
the server process.

## Flow

```
OrderEmailService.sendCustomerOrderEmail     (orderMongoId only once paid)
  or OrderEmailService.sendPaymentReceivedEmail (admin marked it paid)
  └─ mail-queue: new-order-customer / payment-received-customer
                                               (MailProcessor, retries/backoff)
       ├─ InvoiceService.generateAndStore(orderId)
       │    1. Invoice record: one per order (unique), with the frozen snapshot
       │    2. stored already? → read the file back (sha-256 checked)
       │    3. generation lease (lockId/lockedUntil), so two workers never both render
       │    4. snapshot → Typst → PDF → FileUploadService.saveFileToDisk
       │    5. commit only while holding the lease; else drop own file, use the winner's
       │    6. mirror on order.InvoicePdf (never over a file already there)
       └─ EmailService.send_order_confirmation(job, attachment)
```

- **Failure while retries remain**: the job fails and the mail queue retries it.
- **Failure on the last attempt**: the confirmation goes out without the PDF
  (`hasInvoice: false`), with a warning in the log. The invoice stays
  `failed`; an admin can retry it with `POST /order/:id/invoice/regenerate`
  (same permission as updating an order). The retry uses the same data and the
  same number.
- **SMTP failure after the invoice was issued**: the retry reads the stored PDF.
  No new invoice is rendered.
- Issuing state (`status`) and email state (`customerEmail`) are separate
  fields. `smtp_accepted` means the mail server accepted the message, not that
  it reached the inbox.

## Files

| File | Role |
|---|---|
| `invoice-data.builder.ts` | Port of the preview's `useInvoiceData` plus component logic. Every value comes out as formatted text. |
| `typst/invoice.typ` | Layout only (sections, labels, colours, sizes of the preview). Computes nothing. |
| `typst/fonts/` | Inter and Noto Kufi Arabic (the storefront's fonts, as TTF), Inter latin-ext (₺, accented letters), and Riyal (U+20C1 ⃁). Licences are alongside. |
| `renderers/` | `PdfRenderer` interface. `typst-node` (native binding, default) and `typst-cli` (executable), chosen with `INVOICE_PDF_RENDERER`. |
| `schemas/invoice.schema.ts` | The issued invoice: snapshot, number, file, hash, lease, attempts, errors, email state. |
| `pdf-document.issuer.ts` | Shared by invoices and credit notes: lease, render (logo, QR), store, read back with a sha-256 check. |
| `credit-note.calculator.ts` | A credit note's amounts from the order's frozen numbers. Pure. |
| `credit-note-data.builder.ts` | The credit note's snapshot: the invoice's, with the returned lines. |
| `credit-note.service.ts`, `schemas/credit-note.schema.ts` | Credit notes: reserve, issue (number), void, PDF. |

Each products line shows its **unit** (الوحدة / UNT): the line's shipping
profile package type at purchase (`shippingSnapshot.packageType`, or the
variant's profile for old orders), in the storefront's words (piece = حبة,
box = كرتون, …), else `-`. The preview shows the same column
(`InvoiceItemsTable.tsx`).

The snapshot is frozen at the first issuing attempt. It holds the order's
stored lines and amounts and the store's details at that moment, and the PDF is
always rendered from it. A later change to products, settings or the order
does not change an issued invoice. Current product prices are never read; the
product title and attributes are read only for old orders whose lines have no
snapshot of them.

## Differences from the preview (deliberate)

Amounts, texts, amount in words and the full QR payload are identical to the
preview's: `invoice-data.builder.spec.ts` checks them against values printed
by the client's own code. Three preview bugs were fixed on both sides to get
there:

- **Stored VAT of 0.** `taxAmount || net × 0.15` showed 15 % VAT on a VAT-free
  order. Both sides now use `??`, so the 15 % estimate (and the `grandTotal`
  one) applies only to old orders that never stored the field. Orders are
  read lean, so a missing field stays undefined.
- **QR tag 6.** The client's `sha256Hex` padded its input wrongly, so it was
  not SHA-256 (`sha256("abc")` gave `58a8190d…`, not `ba7816bf…`). Both sides
  now produce standard SHA-256.
- **Description before a delivery receipt exists.** It read `… - undefined`;
  both sides now print `… - `.

What still differs:

| Item | Preview (client) | PDF (here) | Why |
|---|---|---|---|
| Dates and year in the number | Browser's timezone | Store's timezone (`resolveStoreTimezone`) | The same for a customer in the store's country. |
| "Printed On" | The day it is viewed | The issue date | A re-render of the same invoice stays identical. |
| Amount currency | The viewer's (USD when browsing in English) | The order's currency (the store's for old orders that never stored one), Arabic formatting | It is the tax document, and the store may switch currency before it is issued (on payment). |
| Amounts font (`font-mono`) | System monospace (e.g. Consolas) | Inter with tabular figures | No monospace font is bundled. |
| Several pages | Download shrinks everything onto one page | Real A4 pages; the product table header repeats; a page footer shows `n / total` | Long orders stay readable. On one page the output is identical ("1 / 1"). |
| Characters outside the bundled fonts | System fonts | Typst's built-in Libertinus Serif | e.g. some Turkish letters. `renderers/font-coverage.spec.ts` checks every label, amount in words and currency symbol. |
| Logo that cannot be read | Broken image | The default logo, plus a warning | The invoice must not wait on it forever. |

Pixel units: 1 preview CSS px = 0.6 pt (the ~900 px dialog spans A4), with 6 mm
margins. Colours are the Tailwind v4 and theme values the preview uses.

## Storage

- Files go through `FileUploadService.saveFileToDisk` into folder `Invoice`, on
  the active provider. Cloudinary stores PDFs as `raw`: check that the
  account's "Allow delivery of PDF and ZIP files" setting is on, because the
  file is read back to re-attach it.
- Local storage must survive a redeploy: in production `UPLOADS_ROOT` must
  point outside the deployed folder (e.g. `/home/<user>/uploads`). If the app
  runs on several machines without a shared disk, use Cloudinary.
- An issued invoice file is never deleted by the order: not on a status
  update, not when an admin replaces or removes `InvoicePdf` (that only
  unlinks it), and not when the order is deleted. The Invoice record is kept
  too. How long to keep it is the business's retention policy.

## Hosting check (Hostinger)

Run `node scripts/invoice-smoke.mjs` on the host before relying on it. It
prints the OS, libc, timings, peak memory and PDF size, and fails on an error,
a warning, or a table that does not span two pages. Locally (Windows x64):
compiler ~20 ms, compile ~20 ms, PDF ~6 ms, ~76 MB RSS.

If the native binding does not load, set `INVOICE_PDF_RENDERER=typst-cli` and
`TYPST_BIN` to a static `typst` executable (`chmod +x`). If neither works, do
not add an external PDF service without deciding it first.

## Credit notes (مرتجع ضريبي)

A refund needs a tax credit note against the issued invoice. It has its own
serial, `RUH-R-8-{year}-{serial}` (counter `creditNoteNumber`), names the
invoice it reverses (number and date), and lists only the returned lines, at
the invoice price. It uses the same template and the invoice's frozen store
and customer details.

**Amounts** (`credit-note.calculator.ts`):
- Each line is priced at invoice price × returned quantity.
- Each line gives back its own share of the coupon. The share is set at
  checkout and frozen on the line (`items[].discount`, see below).
- VAT follows the order's rate and mode (`taxPercentage`, `taxesIncluded`), as
  checkout does.
- Shipping depends on the reason for the return (see "Return policy" below).

**Coupons** (`coupons/shared/coupon-allocation.ts`, shared by checkout and
credit notes):

A coupon may cover the whole order (`applyTo: all`) or only some products,
categories or brands. At checkout:
- `CouponHelperService.applyCouponIfAvailable` computes the discount on the
  covered lines (unchanged).
- It also splits that discount across them by value, in halalas, so the shares
  add up exactly. Uncovered lines get 0.
- Each order line stores its share as `items[].discount`.

A return gives back that share, in proportion to the quantity returned. The
return that empties a line takes what is left of its share.

Example: A is 2 × 100 and B is 1 × 300, with a 50 % coupon on A only (100 off).
- Returning B gives back 300 + VAT = 345.
- Returning one A gives back 50 + VAT = 57.50.

Orders from before `items[].discount`:

| Coupon | Share used | Flagged |
|---|---|---|
| None, or on the whole order | The order's discount in proportion to value (exact) | No |
| On some items, still exists | Its current rules applied to the lines' frozen product, brand and category | Yes: `discountEstimated`, the dialog asks the admin to check the amount |
| Deleted, or its rules match no line now | In proportion to value | Yes |

In every case the last credit note still takes the invoice's remainder.

**Where they come from** (`order/shared/order-helper/order-credit-note.service.ts`):

| Trigger | Credit note | Money | Stock |
|---|---|---|---|
| Dashboard, "Return items" (`POST /order/:id/credit-notes`, REFUND_ORDER), some items or the whole order, with a reason | The chosen lines and quantities | Moyasar paid: refunded through Moyasar. COD or transfer paid: recorded on the order (paid back by hand). Unpaid: none. A refund already made without a credit note is used first. | Restocked unless unticked |
| A customer's return request, approved in the dashboard (see "Return policy") | The requested lines (the admin may change them), with the request's reason | As above | Restocked unless unticked |
| Full refund made in the Moyasar dashboard | Automatic, everything not returned yet, with shipping and fees (`defect`) | Already refunded | Restocked before shipping, as before; not after shipping |
| Partial refund made in the Moyasar dashboard (no items) | None: the admins are notified to choose the returned items | Already refunded, used by the next return | — |

**Order of operations:**
1. The lines are reserved first (`awaiting_refund`, inside a transaction that
   bumps the invoice's `creditNoteSeq`), so two returns never take the same
   items. A failed refund voids the note: it frees the lines and never gets a
   number.
2. The note is numbered only once the money is settled, so the series has no
   gaps.
3. A full refund's credit note is keyed by the refund transaction, so a
   replayed webhook issues one note only.
4. Stock comes back only through credit notes: an order with no issued invoice
   (nothing to credit) is restocked directly, as before.

**After issuing:**
- The customer is emailed the PDF (`credit-note-customer`, with the same
  attachment policy as the invoice).
- The PDF shows on both order pages.
- `POST /order/:id/credit-notes/:noteId/regenerate` retries a PDF that failed.

**One email per refund:** the credit note email states the refund (amount, and
how it comes back). The refund email (`order-refunded`) is sent only for money
no credit note accounts for: a partial refund made in the Moyasar dashboard,
or a full refund of an order with no issued invoice.

**Not covered here:**
- A COD return does not change the order's status.
- The credit note email does not say the order was cancelled; the order page
  shows it.

## Return policy

Every return has a reason (`reasonType`), which decides who pays the
shipping:

| | Defect or store error (`defect`), some items | `defect`, the rest of the order | Other reasons (`other`), e.g. a change of mind |
|---|---|---|---|
| Products and their VAT, less their coupon share | ✓ | ✓ (the invoice's remainder) | ✓ |
| Original shipping | The returned lines' shipping, at most what is left of the shipping paid; with VAT when `applyTaxOnCharges` | All that is left | ✗ |
| Payment fees | ✗ | All that is left | ✗ |
| Return shipping | ✗ | ✗ | Kept back from the refund, with VAT when `applyTaxOnCharges` |

Credit notes from before the reason was recorded count as `defect`.

**Shipping for the returned lines** (`OrderCreditNoteService.returnShipping`):
- Weight: the lines' frozen weight × the quantity returned. Older lines use
  their variant's shipping profile.
- Priced with checkout's own functions (`ShippingRatesService`):
  `calculateShipping` to the order's address, then `selectShippingOption` on
  the order's provider.
- `defect`: `calculateShippingCost` applies the store's free-shipping
  threshold on the order's subtotal after its coupon. An order that shipped
  free has no shipping to give back.
- `other`: the customer pays the return shipping **even when the order
  shipped free**. It is priced with a subtotal of 0 (no rate's free-shipping
  threshold is reached) and without the store's threshold.
- Rates are today's, not the purchase's.
- If no rate covers the address now, the return is refused with a message.

**The credit note stays at the value of the goods.**
- The return shipping (`deductions.returnShipping`) lowers neither the credit
  note nor its VAT.
- The customer gets `total − returnShipping` (`refundableAmount`).
- The PDF shows "خصم تكلفة الشحن العكسي (يتحمّلها العميل)" (return shipping
  deducted, paid by the customer) and "صافي المبلغ المسترد" (net refund)
  under the total.
- A boxed clause states the deduction in words, in Arabic and English
  (`summary.deductionNote`, `deductionNoteEn`, from `deductionNotes`): the
  amount, its VAT, the reason (a return for other reasons than a defect, paid
  by the customer under the return policy) and the net refund. The credit
  note email carries the same sentence.
- Credit notes issued before this clause keep their frozen snapshot, without
  it.

**Rounding:**
- The note that returns the last items takes the invoice's remainder. For
  `defect` that is everything; for `other` it is the products part (the
  invoice less what is left of its charges).
- Either way the credit notes add up to the halala.

**Customer requests** (`order/shared/order-helper/order-return-request.service.ts`):
- **Window:** a customer may ask for a return within `returnWindowDays` of
  delivery (`deliveredAt`; older orders: `completedAt`).
  - It is a store setting (dashboard → Settings → Shipping & Taxes; default 5),
    read through the cached settings.
  - Both reasons use the same window. 0 closes customer requests.
  - An admin can still return from the dashboard at any time.
- **The request:** the customer picks the lines and quantities and the reason,
  and writes a description (`POST /order/my-orders/:id/return-requests`;
  `…/preview` shows the expected refund). One request per order can be pending
  at a time, and the customer can withdraw it.
- **Notice:** the roles with REFUND_ORDER are notified.
- **Approval:** the admin approves (`POST /order/:id/return-requests/:requestId/approve`,
  optionally with other quantities). This issues the credit note with the
  request's reason, refunds and restocks. A lease stops two approvals running
  at once, and a failed refund leaves the request pending.
- **Rejection:** the admin rejects with a reason, and it is emailed to the
  customer (`return-request-rejected-customer`).
- **Lists:** `GET /order/return-requests?status=` lists them for the
  dashboard. The order responses carry `returnRequests` and `returnPolicy`.
- **Display:** `GET /settings` carries `returnWindowDays` for the terms page
  and the cart notice; `PATCH /settings` changes it.

## Currencies

Every amount rounds to its currency's smallest unit
(`payments/shared/utils/currency.util.ts`, the table Moyasar uses):

| Decimals | Currencies |
|---|---|
| 2 | SAR, TRY, AED, … |
| 3 (fils) | KWD, BHD, OMR, JOD, IQD, TND, LYD |
| 0 | JPY, … |

**Two helpers do all the rounding:**
- `roundMoney(value, currency)`: for computed amounts. The cart, checkout,
  coupon discount and its per-line split (`allocateCouponDiscount`, in minor
  units), payment fees, shipping (`calculateShipping`), VAT
  (`tax-calculation.util.ts`, `TaxesService.calculateTax`) and the credit note
  calculator all use it, in the order's currency.
- `cleanMoney`: for sums and differences of amounts already rounded (3
  decimals, safe for every currency). Refundable amounts and the dashboard
  totals use it.

**Display:** the PDF (`formatInvoiceCurrency`) and the storefront
(`lib/currency.ts`) show the currency's own decimals.

**Without a currency:** the rounding stays at 2 decimals, as before. SAR
results did not change. The order's currency is frozen at checkout, and the
invoice prints it even if the store switches currency later.

**Not changed:** the ZATCA QR keeps 2 decimals (`toFixed(2)`). It is a Saudi,
SAR-only field.

## Dashboard: invoices & credit notes

The page `/dashboard/invoices` lists every issued document: invoices in one
tab, credit notes in the other. Above the tabs, cards show the period's totals
(invoices, credit notes, their net and its VAT) and what failed to issue.

**Never edited or deleted.** An issued invoice or credit note is a tax
document:
- A mistake is corrected, or an invoice cancelled, by a credit note ("Issue
  credit note" opens the order's return dialog).
- Deleting an order keeps both.

**Routes** (`order/invoices.controller.ts`, in the order module: its guards
need AuthModule, which reaches this module through EmailModule):

| Route | Permission | |
|---|---|---|
| `GET /invoices` | `view_invoices` | Search, `status`, `from`/`to` on `issuedAt`, paging |
| `GET /invoices/credit-notes` | `view_invoices` | Search, `reasonType`, `state`, dates, paging |
| `GET /invoices/stats` | `view_invoices` | The period's totals and failed counts |
| `GET /invoices/export?type=invoices\|credit-notes` | `view_invoices` | CSV, same filters, at most 10,000 rows |
| `POST /invoices/:orderId/resend` | `update_order_status` | The invoice emailed again (3 a minute) |
| `POST /invoices/credit-notes/:noteId/resend` | `refund_order` | The credit note emailed again (3 a minute) |

**How the routes work:**
- **Search** (`InvoiceQueryService`): the document number, the customer name
  on the frozen snapshot, the order number, or the customer's email or phone
  (through their orders).
- **CSV** (`utils/csv.ts`):
  - UTF-8 with a BOM, so Excel reads Arabic.
  - Store-timezone dates and a totals row.
  - Text that a spreadsheet would run as a formula is neutralised.
- **Resend:** the invoice goes in the "payment received" email with
  `resend: true`, past its once-only rule. The credit note goes in its own
  email (`OrderCreditNoteService.emailCustomer`, shared with issuing).
- **Retry:** a failed PDF is retried, and a credit note issued, through the
  order routes above.

## Compliance

The QR follows the phase-1 TLV layout (seller, VAT number, time, total, VAT)
plus a self-computed hash. This is **not** a ZATCA phase-2 (Fatoora) e-invoice:
that needs UBL XML, a cryptographic stamp, onboarding (CSID) and
clearance/reporting. Whether the store needs it, and whether its invoices are
simplified (B2C) or standard (B2B) tax invoices, must be confirmed with an
accountant. Porting the preview's layout does not by itself make the invoice
compliant.
