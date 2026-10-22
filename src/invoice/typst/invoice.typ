// Tax invoice, laid out like the client's invoice preview
// (cleint/features/orders/components/InvoicePreviewDialog.tsx and
// invoice/components/*): same sections, order, labels, colours and sizes.
// Every value arrives formatted in `sys.inputs.data` (InvoiceSnapshot, see
// invoice-data.builder.ts); nothing is computed here. Images are mapped by the
// renderer: /logo.png and /qr.png.

// From the native binding's inputs, or a file next to the template (CLI)
#let d = if "data" in sys.inputs {
  json(bytes(sys.inputs.data))
} else {
  json("/data.json")
}

// One CSS pixel of the preview: its ~900px wide invoice (max-w-4xl modal)
// spans the A4 width, so an ordinary order fits on one page as it does there
#let px = 0.6pt

// Tailwind (v4) and theme colours used by the preview
#let black = rgb("#000000")
#let white = rgb("#ffffff")
#let primary = rgb("#2563eb")
#let muted = rgb("#f4f4f5")
#let sky-100 = rgb("#dff2fe")
#let sky-200 = rgb("#b8e6fe")
#let sky-950 = rgb("#052f4a")
#let slate-50 = rgb("#f8fafc")
#let slate-100 = rgb("#f1f5f9")
#let slate-200 = rgb("#e2e8f0")
#let slate-400 = rgb("#90a1b9")
#let slate-600 = rgb("#45556c")
#let slate-700 = rgb("#314158")
#let slate-800 = rgb("#1d293d")
#let slate-900 = rgb("#0f172b")
#let red-50 = rgb("#fef2f2")
#let red-500 = rgb("#fb2c36")
#let red-700 = rgb("#c10007")
#let red-900 = rgb("#82181a")
#let badge-fill = rgb("#f6f6f7") // secondary/80 on white
#let badge-text = rgb("#18181b")
#let badge-border = rgb("#f7f7f8") // border/30 on white

// Weights the browser resolves with the 400/600/800 font files:
// medium (500) → 400, semibold → 600, bold (700) and black (900) → 800
#let medium = 400
#let semibold = 600
#let bold = 800

#let line-w = 1 * px
#let gap(n) = v(n * px, weak: true)

#set document(title: "فاتورة ضريبية - " + d.displayNumber)
#set page(
  paper: "a4",
  margin: (x: 6mm, y: 6mm),
  // Only when the products spill over: the closing footer shows "1 / 1"
  footer: context {
    let total = counter(page).final().first()
    if total > 1 {
      align(center, text(size: 8.5 * px, fill: slate-600)[
        #text(dir: ltr, counter(page).display("1 / 1", both: true))
      ])
    }
  },
)
#set text(
  font: ("Inter", "Noto Kufi Arabic", "Riyal"),
  lang: "ar",
  dir: rtl,
  size: 12 * px,
  fill: slate-900,
  number-width: "tabular",
  // CSS line boxes of the preview (line-height 1.333 over Inter and Noto Kufi
  // Arabic): 1.03em above the baseline, 0.333em below, no extra leading
  top-edge: 1.03em,
  bottom-edge: -0.333em,
)
#set par(leading: 0pt, spacing: 0pt)
#set table(stroke: line-w + black)

// A Tailwind `font-mono` amount: tabular figures (no monospace font is bundled)
#let amount(body, ..args) = text(..args, body)

// ═══ 1. Header ═══
#block(
  width: 100%,
  inset: (bottom: 8 * px),
  stroke: (bottom: line-w + black),
  grid(
    columns: (1fr, 1fr, 1fr),
    align: (right + horizon, center + horizon, left + horizon),
    column-gutter: 8 * px,
    // Arabic column (right)
    text(size: 11 * px, fill: slate-800)[
      #text(size: 12 * px, weight: bold, fill: primary, d.header.siteNameAr)
      #gap(2)
      #text(weight: semibold)[رقم السجل التجاري:] #text(weight: bold, d.header.crNo)
      #gap(2)
      #text(weight: semibold)[رقم التسجيل الضريبي:] #text(weight: bold, d.header.vatNo)
    ],
    // Logo and names (centre)
    {
      image("/logo.png", height: 64 * px)
      gap(4)
      text(size: 12 * px, weight: bold, fill: sky-950, d.header.siteNameAr)
      gap(2)
      text(size: 9 * px, weight: medium, fill: slate-600, d.header.siteNameEn)
    },
    // English column (left)
    text(size: 11 * px, fill: slate-800, dir: ltr)[
      #text(size: 12 * px, weight: bold, fill: primary, upper(d.header.siteNameEn))
      #gap(2)
      #text(weight: semibold)[CR No.:] #text(weight: bold, d.header.crNo)
      #gap(2)
      #text(weight: semibold)[VAT Registration number:] #text(weight: bold, d.header.vatNo)
    ],
  ),
)

#gap(16)

// ═══ 2. Title and meta table ═══
#grid(
  columns: (1fr, auto, 1fr),
  align: horizon,
  column-gutter: 16 * px,
  line(length: 100%, stroke: line-w + black),
  box(
    fill: sky-100,
    stroke: line-w + black,
    radius: 4 * px,
    inset: (x: 24 * px, y: 4 * px),
    text(size: 14 * px, weight: bold, fill: sky-950)[فاتورة ضريبية / Tax Invoice],
  ),
  line(length: 100%, stroke: line-w + black),
)

#gap(8)

#{
  set text(size: 10 * px)
  let label(body) = table.cell(fill: slate-100, text(weight: bold, body))
  table(
    columns: (1fr, 2fr, 1fr, 2fr),
    inset: 6 * px,
    align: center + horizon,
    fill: (_, y) => if y != 1 { muted },
    label[التاريخ / Date:],
    text(weight: bold, d.meta.date),
    label[الرقم / No:],
    text(weight: bold, d.meta.number),
    label[مكان التوصيل / Place of delivery:],
    table.cell(colspan: 3, align: right + horizon, fill: white, text(weight: semibold, d.meta.placeOfDelivery)),
    label[البيان / Description:],
    table.cell(colspan: 3, align: right + horizon, text(weight: semibold, d.meta.description)),
  )
}

#gap(16)

// ═══ 3 & 4. Vendor and customer boxes ═══
#let party(title, vat-title, p) = block(
  width: 100%,
  stroke: line-w + black,
  {
    set text(size: 10 * px)
    block(
      width: 100%,
      inset: 6 * px,
      fill: muted.transparentize(60%),
      stroke: (bottom: line-w + black),
      grid(
        columns: (1fr, auto),
        column-gutter: 8 * px,
        align: (right + top, center + top),
        text(weight: bold)[
          #box(fill: sky-100, inset: 4 * px, text(fill: sky-950)[#title:])
          #gap(8)
          #p.name
        ],
        text(weight: bold)[
          #box(fill: sky-100, inset: 4 * px, text(fill: sky-950, vat-title))
          #gap(8)
          #text(tracking: 0.05em, p.vatNo)
        ],
      ),
    )
    table(
      columns: (1fr,) * 6,
      inset: 4 * px,
      align: center + horizon,
      stroke: (x, y) => (
        left: if x > 0 { line-w + black },
        right: if x > 0 { none },
        top: if y == 1 { line-w + black },
      ),
      table.header(
        ..([البلد | Country], [المنطقة | Area], [المدينة | City], [الشارع | Street], [صندوق بريد | Mail Box], [الرمز البريدي | Po Box]).map(h => table.cell(fill: slate-100, text(weight: semibold, h))),
      ),
      p.address.country, p.address.area, p.address.city, p.address.street, p.address.mailBox, p.address.poBox,
    )
  },
)

#party([المورد / Vendor], [Vendor VAT No / الرقم الضريبي للمنشأة], d.vendor)
#gap(16)
#party([العميل / Customer], [Customer VAT No / الرقم الضريبي للعميل], d.customer)

#gap(16)

// ═══ 5. Products ═══
#{
  set text(size: 10 * px)
  // A product line never splits across two pages
  set table.cell(breakable: false)
  let badge(body) = box(
    fill: badge-fill,
    stroke: line-w + badge-border,
    radius: 6 * px,
    inset: (x: 4 * px, y: 2 * px),
    text(size: 8 * px, weight: semibold, fill: badge-text, body),
  )
  table(
    columns: (32 * px, 1fr, 56 * px, 80 * px, 96 * px),
    inset: 6 * px,
    align: (x, y) => if x == 1 { right + horizon } else { center + horizon },
    table.header(
      repeat: true,
      ..([\#], [البيان / Description], [الكمية / Qty], [الأفرادي / Price], [الإجمالي / Total])
        .map(h => table.cell(fill: sky-100, text(weight: bold, fill: sky-950, h))),
    ),
    ..d.items
      .map(item => (
        text(weight: medium, item.index),
        {
          text(weight: semibold, fill: slate-900, item.titleAr)
          if item.titleEn != "" {
            gap(2)
            text(size: 9 * px, fill: slate-600, item.titleEn)
          }
          if item.badges.len() > 0 {
            gap(4)
            block(width: 200 * px, item.badges.map(badge).join(h(4 * px)))
          }
        },
        text(weight: medium, item.quantity),
        amount(item.price),
        amount(item.total, weight: semibold),
      ))
      .flatten(),
  )
}

#gap(16)

// ═══ 6. Summary and QR ═══
#block(breakable: false, {
  let s = d.summary
  let rows = (
    ([إجمالي المنتجات / Products Total], s.subtotal),
    ([مجموع الخصومات / Total Discount], s.discount),
  )
  if "productsBeforeTax" in s {
    rows.push(([صافي المنتجات قبل الضريبة / Net Products (Excluding VAT)], s.productsBeforeTax))
  }
  if "productsAfterTax" in s {
    rows.push(([صافي المنتجات شامل الضريبة / Net Products (Including VAT)], s.productsAfterTax))
  }
  rows += (
    ([تكلفة الشحن / Shipping Cost], s.shipping),
    ([رسوم الدفع / Payment Fees], s.paymentFees),
    ([الإجمالي غير شامل الضريبة / Total Amount (Excluding VAT)], s.taxableSubtotal),
    ([ضريبة القيمة المضافة / VAT Amount], s.tax),
  )

  gap(8)
  grid(
    columns: (144 * px, 1fr),
    column-gutter: 16 * px,
    align: (center + top, top),
    box(inset: 4 * px, image("/qr.png", width: 140 * px)),
    {
      set text(size: 10 * px)
      table(
        columns: (3fr, 2fr),
        inset: 6 * px,
        align: (right + horizon, left + horizon),
        ..rows
          .map(((label, value)) => (
            table.cell(fill: sky-100, text(weight: bold, label)),
            amount(value, weight: bold),
          ))
          .flatten(),
        table.cell(fill: sky-200, text(weight: bold, fill: sky-950)[الإجمالي شامل ضريبة القيمة المضافة / Total Amount (Including VAT)]),
        table.cell(fill: sky-200, amount(s.grandTotal, weight: bold, fill: sky-950, size: 16 * px)),
      )
    },
  )
  gap(8)
  block(
    width: 100%,
    fill: slate-100,
    stroke: line-w + black,
    inset: 8 * px,
    align(center, text(size: 12 * px, weight: bold, fill: slate-900)[المبلغ المطلوب: #s.amountWords]),
  )
})

#gap(16)

// ═══ 7. Signatures, bank details and return policy ═══
#block(breakable: false, {
  set text(size: 10 * px)
  block(
    width: 100%,
    stroke: line-w + black,
    inset: 12 * px,
    grid(
      columns: (1fr, 1fr),
      column-gutter: 16 * px,
      // Signatures (right)
      {
        block(
          width: 100%,
          inset: (bottom: 8 * px),
          stroke: (bottom: (paint: slate-400, thickness: line-w, dash: "dashed")),
          grid(
            columns: (1fr, auto),
            text(weight: bold)[أعدت من قبل / Prepared by:], [..........],
          ),
        )
        gap(8)
        grid(
          columns: (1fr, auto),
          text(weight: bold)[المستلم / Received by:], [..........],
        )
      },
      // Bank account (left)
      block(
        width: 100%,
        fill: slate-50,
        stroke: (right: line-w + black),
        inset: 8 * px,
        {
          set align(right)
          set text(weight: medium)
          [#text(weight: bold)[اسم الحساب / Account Name:] #d.bank.accountName]
          gap(4)
          [#text(weight: bold)[البنك / Bank:] #d.bank.bankName]
          gap(4)
          [#text(weight: bold)[رقم الحساب / Account No.:] #d.bank.accountNumber]
          gap(4)
          [#text(weight: bold)[رقم الحساب الدولي / IBAN:] #d.bank.iban]
        },
      ),
    ),
  )
  gap(16)
  block(
    width: 100%,
    fill: red-50,
    stroke: line-w + red-500,
    inset: 8 * px,
    align(center, text(weight: semibold, fill: red-900)[
      #text(weight: bold, fill: red-700, underline[سياسة الاستبدال والاسترجاع:])
      #gap(2)
      استبدال واسترجاع خلال 5 أيام فقط من تاريخ الفاتورة شرط ان تكون المنتجات على حالتها الاصلية
    ]),
  )
})

#gap(16)

// ═══ 8. Company address and contact footer ═══
#block(
  breakable: false,
  width: 100%,
  inset: (top: 8 * px),
  stroke: (top: 2 * line-w + black),
  {
    set text(size: 9 * px, fill: slate-700)
    set align(center)
    text(weight: semibold, d.footer.addressAr)
    gap(4)
    text(size: 8.5 * px, dir: ltr, d.footer.addressEn)
    gap(4)
    block(
      width: 100%,
      inset: (top: 4 * px),
      stroke: (top: line-w + slate-200),
      text(size: 8.5 * px, fill: slate-600, grid(
        columns: (1fr, auto, 1fr),
        align: (right, center, left),
        text(dir: ltr)[Printed On: #d.footer.printedOn],
        context text(dir: ltr, counter(page).display("1 / 1", both: true)),
        text(dir: ltr, d.footer.contact),
      )),
    )
  },
)
