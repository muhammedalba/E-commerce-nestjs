/**
 * Invoice PDF smoke test (phase 0): checks that Typst runs on this host with
 * the invoice fonts, before relying on it for real invoices.
 *
 *   node scripts/invoice-smoke.mjs [out.pdf]
 *
 * Renders mixed Arabic/English/number lines, the riyal sign (U+20C1), a QR
 * code and a products table long enough to span two pages, then prints the
 * host facts, timings and peak memory. Exits non-zero on any failure or
 * missing glyph.
 */
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import QRCode from 'qrcode';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fontsDir = path.join(root, 'src', 'invoice', 'typst', 'fonts');
const out = process.argv[2] || path.join(os.tmpdir(), 'invoice-smoke.pdf');

const sh = (cmd) => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .split('\n')[0]
      .trim();
  } catch {
    return 'n/a';
  }
};

console.log('host      :', os.platform(), os.arch(), os.release());
console.log('libc      :', sh('ldd --version'));
console.log('node      :', process.version);
console.log('memory    :', Math.round(os.totalmem() / 2 ** 20), 'MB total');

let peakRss = process.memoryUsage().rss;
const sample = () => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
};

const rows = Array.from({ length: 70 }, (_, i) => ({
  n: String(i + 1),
  ar: `منتج تجريبي رقم ${i + 1}`,
  en: `Sample product ${i + 1} (XL / أزرق)`,
  qty: String((i % 3) + 1),
  price: '1,234.50 ⃁',
}));

const source = String.raw`
#let d = json(bytes(sys.inputs.data))
#set page(paper: "a4", margin: 8mm, footer: context align(center, text(size: 8pt)[#counter(page).display("1 / 1", both: true)]))
#set text(font: ("Inter", "Noto Kufi Arabic", "Riyal"), lang: "ar", dir: rtl, size: 10pt, fallback: false)

= فاتورة ضريبية / Tax Invoice
التاريخ / Date: #d.date — الرقم / No: #d.number

#text(weight: 800)[الإجمالي شامل ضريبة القيمة المضافة / Total Amount (Including VAT): #d.total]

#text(weight: 600)[المبلغ المطلوب: #d.words]

#text(dir: ltr)[VAT Registration number: 300000000000003 — CR No.: 1010101010]

#image("/qr.png", width: 36mm)

#table(
  columns: (auto, 1fr, auto, auto),
  stroke: 0.5pt + black,
  fill: (_, y) => if y == 0 { rgb("#e0f2fe") },
  table.header(repeat: true)[\#][البيان / Description][الكمية / Qty][الأفرادي / Price],
  ..d.rows.map(r => (r.n, [#r.ar \ #text(size: 8pt)[#r.en]], r.qty, r.price)).flatten(),
)
`;

try {
  let t = performance.now();
  const compiler = NodeCompiler.create({
    workspace: root,
    fontArgs: [{ fontPaths: [fontsDir] }],
  });
  sample();
  const tCreate = performance.now() - t;

  const qr = await QRCode.toBuffer('AQxTa3lHYWxheHkgVGVzdA==', {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 280,
  });
  // Shadow paths are real paths under the workspace, seen as "/qr.png"
  compiler.mapShadow(path.join(root, 'qr.png'), qr);

  const data = JSON.stringify({
    date: '10/22/2026',
    number: 'RUH-8-2026-0042',
    total: '67.85 ⃁',
    words: 'فقط سبعة وستون ريالاً سعودياً وخمس وثمانون هللة لا غير',
    rows,
  });

  t = performance.now();
  const result = compiler.compile({
    mainFileContent: source,
    inputs: { data },
  });
  sample();
  const err = result.takeError();
  if (err) {
    console.error('compile error:', compiler.fetchDiagnostics(err));
    process.exit(1);
  }
  const warnings = result.takeWarnings();
  const doc = result.result;
  const tCompile = performance.now() - t;

  t = performance.now();
  const pdf = compiler.pdf(doc);
  sample();
  const tPdf = performance.now() - t;

  writeFileSync(out, pdf);
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || [])
    .length;

  console.log('compiler  :', tCreate.toFixed(0), 'ms (fonts loaded)');
  console.log('compile   :', tCompile.toFixed(0), 'ms');
  console.log('pdf       :', tPdf.toFixed(0), 'ms');
  console.log('peak rss  :', Math.round(peakRss / 2 ** 20), 'MB');
  console.log(
    'pdf size  :',
    Math.round(pdf.length / 1024),
    'KB,',
    pages,
    'pages',
  );
  console.log('valid pdf :', pdf.subarray(0, 5).toString() === '%PDF-');
  console.log('written   :', out);

  if (warnings) {
    // fallback: false turns a missing glyph into a warning: fail on it
    console.error(
      'warnings:',
      JSON.stringify(compiler.fetchDiagnostics(warnings)),
    );
    process.exit(2);
  }
  if (pages < 2) {
    console.error('expected the products table to span at least 2 pages');
    process.exit(3);
  }
  console.log('OK');
} catch (e) {
  console.error('FAILED:', e);
  process.exit(1);
}
