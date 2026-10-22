# Tax invoice (PDF)

When an order is confirmed, the customer's order-confirmation email issues the
order's tax invoice, stores it, and attaches it to that same email. COD and
other offline methods are confirmed when the order is created; Moyasar is
confirmed when the payment succeeds. The invoice is also shown on the order
(`InvoicePdf`): as an iframe in the dashboard, and as "download invoice" on the
customer's order page.

No browser is involved. The PDF is typeset by [Typst](https://typst.app), in
the server process.

## Flow

```
OrderEmailService.sendCustomerOrderEmail   (orderMongoId in the job)
  └─ mail-queue: new-order-customer         (MailProcessor, retries/backoff)
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
| Amount currency | The viewer's (USD when browsing in English) | The store's base currency, Arabic formatting | It is the tax document. |
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

## Compliance

The QR follows the phase-1 TLV layout (seller, VAT number, time, total, VAT)
plus a self-computed hash. This is **not** a ZATCA phase-2 (Fatoora) e-invoice:
that needs UBL XML, a cryptographic stamp, onboarding (CSID) and
clearance/reporting. Whether the store needs it, and whether its invoices are
simplified (B2C) or standard (B2B) tax invoices, must be confirmed with an
accountant. Porting the preview's layout does not by itself make the invoice
compliant.
