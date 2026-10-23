/**
 * Arabic amount in words (تفقيط المبلغ) for invoices, in the order's currency,
 * with its minor unit (هللات، فلوس، …) and full number–noun agreement:
 * "فقط سبعة وستون ريالاً سعودياً وخمس وثمانون هللة لا غير".
 *
 * Server copy of cleint/features/orders/components/invoice/utils/arabicAmountWords.ts
 * so the issued PDF spells the amount exactly like the invoice preview: keep
 * both in sync.
 */

import {
  normalizeCurrency as normalizeCode,
  toMinorUnits,
} from 'src/payments/shared/utils/currency.util';

/** Like the client's normalizeCurrency: an empty code means the store's SAR. */
const normalizeCurrency = (currency: string | null | undefined): string =>
  normalizeCode(currency || 'SAR');

type Gender = 'm' | 'f';

/** The forms a counted noun takes: 1 / 2 / 3–10 / 11–99 (and 0 after 100s). */
interface UnitForms {
  gender: Gender;
  singular: string;
  dual: string;
  plural: string;
  accusative: string;
}

/** A counted noun's forms, e.g. unit("f", "هللة", "هللتان", "هللات", "هللة"). */
const unit = (
  gender: Gender,
  singular: string,
  dual: string,
  plural: string,
  accusative: string,
): UnitForms => ({ gender, singular, dual, plural, accusative });

const HALALA = unit('f', 'هللة', 'هللتان', 'هللات', 'هللة');
const FILS = unit('m', 'فلس', 'فلسان', 'فلوس', 'فلساً');
const DIRHAM = unit('m', 'درهم', 'درهمان', 'دراهم', 'درهماً');
const QIRSH = unit('m', 'قرش', 'قرشان', 'قروش', 'قرشاً');
const CENT = unit('m', 'سنت', 'سنتان', 'سنتات', 'سنتاً');
const CENTIME = unit('m', 'سنتيم', 'سنتيمان', 'سنتيمات', 'سنتيماً');

/** A riyal with its country adjective (ريال سعودي، ريالان سعوديان، …). */
const riyal = (
  adj: string,
  adjDual: string,
  adjPlural: string,
  adjAcc: string,
) =>
  unit(
    'm',
    `ريال ${adj}`,
    `ريالان ${adjDual}`,
    `ريالات ${adjPlural}`,
    `ريالاً ${adjAcc}`,
  );
/** A dinar with its country adjective (دينار كويتي، ديناران كويتيان، …). */
const dinar = (
  adj: string,
  adjDual: string,
  adjPlural: string,
  adjAcc: string,
) =>
  unit(
    'm',
    `دينار ${adj}`,
    `ديناران ${adjDual}`,
    `دنانير ${adjPlural}`,
    `ديناراً ${adjAcc}`,
  );
/** A lira (feminine) with its country adjective (ليرة تركية، ليرتان تركيتان). */
const lira = (adj: string, adjDual: string) =>
  unit('f', `ليرة ${adj}`, `ليرتان ${adjDual}`, `ليرات ${adj}`, `ليرة ${adj}`);

/** Major + minor unit per store currency (see shared/constants/currencies.ts). */
const CURRENCY_WORDS: Record<string, { major: UnitForms; minor: UnitForms }> = {
  SAR: { major: riyal('سعودي', 'سعوديان', 'سعودية', 'سعودياً'), minor: HALALA },
  QAR: { major: riyal('قطري', 'قطريان', 'قطرية', 'قطرياً'), minor: DIRHAM },
  OMR: {
    major: riyal('عماني', 'عمانيان', 'عمانية', 'عمانياً'),
    minor: unit('f', 'بيسة', 'بيستان', 'بيسات', 'بيسة'),
  },
  YER: { major: riyal('يمني', 'يمنيان', 'يمنية', 'يمنياً'), minor: FILS },
  KWD: { major: dinar('كويتي', 'كويتيان', 'كويتية', 'كويتياً'), minor: FILS },
  BHD: {
    major: dinar('بحريني', 'بحرينيان', 'بحرينية', 'بحرينياً'),
    minor: FILS,
  },
  JOD: { major: dinar('أردني', 'أردنيان', 'أردنية', 'أردنياً'), minor: FILS },
  IQD: { major: dinar('عراقي', 'عراقيان', 'عراقية', 'عراقياً'), minor: FILS },
  LYD: { major: dinar('ليبي', 'ليبيان', 'ليبية', 'ليبياً'), minor: DIRHAM },
  DZD: {
    major: dinar('جزائري', 'جزائريان', 'جزائرية', 'جزائرياً'),
    minor: CENTIME,
  },
  TND: {
    major: dinar('تونسي', 'تونسيان', 'تونسية', 'تونسياً'),
    minor: unit('m', 'مليم', 'مليمان', 'مليمات', 'مليماً'),
  },
  AED: {
    major: unit(
      'm',
      'درهم إماراتي',
      'درهمان إماراتيان',
      'دراهم إماراتية',
      'درهماً إماراتياً',
    ),
    minor: FILS,
  },
  MAD: {
    major: unit(
      'm',
      'درهم مغربي',
      'درهمان مغربيان',
      'دراهم مغربية',
      'درهماً مغربياً',
    ),
    minor: CENTIME,
  },
  EGP: {
    major: unit(
      'm',
      'جنيه مصري',
      'جنيهان مصريان',
      'جنيهات مصرية',
      'جنيهاً مصرياً',
    ),
    minor: QIRSH,
  },
  GBP: {
    major: unit(
      'm',
      'جنيه إسترليني',
      'جنيهان إسترلينيان',
      'جنيهات إسترلينية',
      'جنيهاً إسترلينياً',
    ),
    minor: unit('m', 'بنس', 'بنسان', 'بنسات', 'بنساً'),
  },
  TRY: { major: lira('تركية', 'تركيتان'), minor: QIRSH },
  LBP: { major: lira('لبنانية', 'لبنانيتان'), minor: QIRSH },
  SYP: { major: lira('سورية', 'سوريتان'), minor: QIRSH },
  USD: {
    major: unit(
      'm',
      'دولار أمريكي',
      'دولاران أمريكيان',
      'دولارات أمريكية',
      'دولاراً أمريكياً',
    ),
    minor: CENT,
  },
  AUD: {
    major: unit(
      'm',
      'دولار أسترالي',
      'دولاران أستراليان',
      'دولارات أسترالية',
      'دولاراً أسترالياً',
    ),
    minor: CENT,
  },
  EUR: { major: unit('m', 'يورو', 'يوروان', 'يوروهات', 'يورو'), minor: CENT },
};

/** Index = value; the gender is the counted noun's (3–10 take the opposite form). */
const ONES: Record<Gender, string[]> = {
  m: [
    '',
    'واحد',
    'اثنان',
    'ثلاثة',
    'أربعة',
    'خمسة',
    'ستة',
    'سبعة',
    'ثمانية',
    'تسعة',
    'عشرة',
  ],
  f: [
    '',
    'واحدة',
    'اثنتان',
    'ثلاث',
    'أربع',
    'خمس',
    'ست',
    'سبع',
    'ثماني',
    'تسع',
    'عشر',
  ],
};
const TENS = [
  '',
  '',
  'عشرون',
  'ثلاثون',
  'أربعون',
  'خمسون',
  'ستون',
  'سبعون',
  'ثمانون',
  'تسعون',
];
const HUNDREDS = [
  '',
  'مائة',
  'مائتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
];

const SCALES: { value: number; forms: UnitForms }[] = [
  { value: 1e9, forms: unit('m', 'مليار', 'ملياران', 'مليارات', 'ملياراً') },
  { value: 1e6, forms: unit('m', 'مليون', 'مليونان', 'ملايين', 'مليوناً') },
  { value: 1e3, forms: unit('m', 'ألف', 'ألفان', 'آلاف', 'ألفاً') },
];

/** 1–99 in words, agreeing with gender `g` (واحد وعشرون / إحدى وعشرون). */
function below100(n: number, g: Gender): string {
  if (n <= 10) return ONES[g][n];
  if (n === 11) return g === 'm' ? 'أحد عشر' : 'إحدى عشرة';
  if (n === 12) return g === 'm' ? 'اثنا عشر' : 'اثنتا عشرة';
  if (n < 20) return `${ONES[g][n - 10]} ${g === 'm' ? 'عشر' : 'عشرة'}`;

  const u = n % 10;
  const tens = TENS[Math.floor(n / 10)];
  if (u === 0) return tens;
  const ones = u === 1 ? (g === 'm' ? 'واحد' : 'إحدى') : ONES[g][u];
  return `${ones} و${tens}`;
}

/** 1–999 in words: the hundreds, then "و" and the rest (مائة وخمسة). */
function below1000(n: number, g: Gender): string {
  const parts: string[] = [];
  if (n >= 100) parts.push(HUNDREDS[Math.floor(n / 100)]);
  if (n % 100) parts.push(below100(n % 100, g));
  return parts.join(' و');
}

/** A positive integer in words, agreeing with a counted noun of gender `g`. */
function integerToArabicWords(n: number, g: Gender): string {
  const parts: string[] = [];
  let rest = n;
  for (const { value, forms } of SCALES) {
    const count = Math.floor(rest / value);
    rest %= value;
    if (count) parts.push(withCount(count, forms, false));
  }
  if (rest) parts.push(below1000(rest, g));
  return parts.join(' و');
}

/**
 * The number plus its counted noun: ريال واحد، ريالان، ثلاثة ريالات،
 * أحد عشر ريالاً، مائة ريال (and مائتا/ألفا ريال: a dual before its noun drops ن).
 * `oneAfter`: 1 is said after the noun (ريال واحد), not just the noun (ألف).
 */
function withCount(n: number, forms: UnitForms, oneAfter: boolean): string {
  if (n === 1) {
    if (!oneAfter) return forms.singular;
    return `${forms.singular} ${forms.gender === 'm' ? 'واحد' : 'واحدة'}`;
  }
  if (n === 2) return forms.dual;

  let words = integerToArabicWords(n, forms.gender);
  const last2 = n % 100;
  if (last2 >= 3 && last2 <= 10) return `${words} ${forms.plural}`;
  if (last2 >= 11) return `${words} ${forms.accusative}`;
  if (last2 === 0 && words.endsWith('ان')) words = words.slice(0, -1);
  return `${words} ${forms.singular}`;
}

/**
 * `amount` (in major units) in words, e.g. 67.85 SAR →
 * "فقط سبعة وستون ريالاً سعودياً وخمس وثمانون هللة لا غير".
 * The minor-unit split follows the same ISO factors as checkout/Moyasar
 * (100 هللة, 1000 فلس, …), on integers so 67.85 never becomes 67.84.
 */
export function amountToArabicWords(
  amount: number,
  currencyCode?: string | null,
): string {
  const code = normalizeCurrency(currencyCode);
  const factor = toMinorUnits(1, code);
  const minorTotal = toMinorUnits(Math.abs(Number(amount) || 0), code);
  const major = Math.floor(minorTotal / factor);
  const minor = minorTotal % factor;

  const words = CURRENCY_WORDS[code];
  if (!words) {
    // Unknown currency: no Arabic names to inflect, so the code and a fraction
    const majorText = major ? integerToArabicWords(major, 'm') : 'صفر';
    const minorText = minor ? ` و${minor}/${factor}` : '';
    return `فقط ${majorText} ${code}${minorText} لا غير`;
  }

  const parts: string[] = [];
  if (major) parts.push(withCount(major, words.major, true));
  if (minor) parts.push(withCount(minor, words.minor, true));
  if (parts.length === 0) parts.push(`صفر ${words.major.singular}`);
  return `فقط ${parts.join(' و')} لا غير`;
}
