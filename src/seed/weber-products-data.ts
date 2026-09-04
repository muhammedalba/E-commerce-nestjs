import { PackageType } from '../products/shared/schemas/shipping-profile.schema';

export interface SeedVariant {
  sku: string;
  label: { ar: string; en: string };
  price: number;
  stock: number;
  attributes: Record<string, any>;
  shippingProfile: {
    weightGrams: number;
    packageType: PackageType;
    quantityPerPackage?: number;
    dimensions?: { lengthMm?: number; widthMm?: number; heightMm?: number };
  };
  components?: Array<{ name: string; value: number; unit: string }>;
}

export interface SeedProductFamily {
  title: { ar: string; en: string };
  slug: string;
  description: { ar: string; en: string };
  subCategorySlug: string;
  allowedAttributes: Array<{
    name: string;
    type: 'string' | 'number';
    allowedValues?: string[];
    allowedUnits?: string[];
  }>;
  variants: SeedVariant[];
}

export const WEBER_CATEGORIES = [
  {
    name: { ar: 'كيميائيات ومواد البناء', en: 'Construction Chemicals' },
    slug: 'construction-chemicals',
    subCategories: [
      {
        name: { ar: 'ترويبات وغراء بلاط', en: 'Tile Grouts & Adhesives' },
        slug: 'tile-grouts-adhesives',
      },
      {
        name: { ar: 'عوازل مائية وحماية', en: 'Waterproofing & Protection' },
        slug: 'waterproofing-protection',
      },
      {
        name: { ar: 'دهانات وإيبوكسي أرضيات', en: 'Flooring & Epoxies' },
        slug: 'flooring-epoxies',
      },
      {
        name: {
          ar: 'معالجة وإصلاح الخرسانة والجراوت',
          en: 'Concrete Repair & Grouts',
        },
        slug: 'concrete-repair-grouts',
      },
      {
        name: { ar: 'معاجين ولياسات جاهزة', en: 'Plasters & Putties' },
        slug: 'plasters-putties',
      },
      {
        name: {
          ar: 'فواصل التمدد ومواد ملء الفواصل',
          en: 'Expansion Joints & Sealants',
        },
        slug: 'expansion-joints-sealants',
      },
    ],
  },
];

export const WEBER_PRODUCTS_DATA: SeedProductFamily[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Weber Joint Perfect (ترويبة جوينت بيرفكت 5 كغ)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    title: {
      ar: 'سودامكو ويبر جوينت بيرفكت 5 كغ',
      en: 'Sodamco Weber Joint Perfect 5 KG',
    },
    slug: 'weber-joint-perfect-5kg',
    description: {
      ar: 'ترويبة إسمنتية عالية الجودة للفواصل بعرض حتى 5 مم، مضادة للماء ومقاومة للعفن ومتوفرة بتشكيلة واسعة من الألوان.',
      en: 'Premium cementitious tile grout for joints up to 5mm, water-resistant, mold-resistant, available in a rich spectrum of colors.',
    },
    subCategorySlug: 'tile-grouts-adhesives',
    allowedAttributes: [
      {
        name: 'color',
        type: 'string',
        allowedValues: [
          'White Jasmine 110',
          'Ivory 120',
          'Beige 121',
          'Clay 122',
          'Cappuccino 123',
          'Terractta 124',
          'Chestnut 125',
          'Chocolate 126',
          'Yellow Pastel 130',
          'Chamomile 131',
          'Mustard 132',
          'Pink Baby 140',
          'Pink Antique 141',
          'Cherry 142',
          'Mint Fresh 150',
          'Leaf Spring 151',
          'Blue Baby 160',
          'Blue Sky 161',
          'Gray Light 170',
          'Grey Platinium 171',
          'Gray Ash 172',
          'Charcoal 173',
          'Black 180',
          'Rock Desert 227',
          'Brown 228',
          'Sahara 233',
          'Grey Silk 274',
          'Grey Pebble 275',
        ],
      },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['5'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009243',
        label: { ar: 'أبيض ياسمين 110', en: 'White Jasmine 110' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'White Jasmine 110',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009244',
        label: { ar: 'عاجي 120', en: 'Ivory 120' },
        price: 45,
        stock: 100,
        attributes: { color: 'Ivory 120', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009245',
        label: { ar: 'بيج 121', en: 'Beige 121' },
        price: 45,
        stock: 100,
        attributes: { color: 'Beige 121', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009246',
        label: { ar: 'طيني 122', en: 'Clay 122' },
        price: 45,
        stock: 100,
        attributes: { color: 'Clay 122', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009247',
        label: { ar: 'كابتشينو 123', en: 'Cappuccino 123' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Cappuccino 123',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009248',
        label: { ar: 'تيراكوتا 124', en: 'Terractta 124' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Terractta 124',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009249',
        label: { ar: 'كستنائي 125', en: 'Chestnut 125' },
        price: 45,
        stock: 100,
        attributes: { color: 'Chestnut 125', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009250',
        label: { ar: 'شوكولاتة 126', en: 'Chocolate 126' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Chocolate 126',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009251',
        label: { ar: 'أصفر باستيل 130', en: 'Yellow Pastel 130' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Yellow Pastel 130',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009252',
        label: { ar: 'بابونج 131', en: 'Chamomile 131' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Chamomile 131',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009253',
        label: { ar: 'خردل 132', en: 'Mustard 132' },
        price: 45,
        stock: 100,
        attributes: { color: 'Mustard 132', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009270',
        label: { ar: 'وردي فاتح 140', en: 'Pink Baby 140' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Pink Baby 140',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009271',
        label: { ar: 'وردي عتيق 141', en: 'Pink Antique 141' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Pink Antique 141',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009272',
        label: { ar: 'كرزي 142', en: 'Cherry 142' },
        price: 45,
        stock: 100,
        attributes: { color: 'Cherry 142', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009273',
        label: { ar: 'نعناع طازج 150', en: 'Mint Fresh 150' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Mint Fresh 150',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009274',
        label: { ar: 'ورقة الربيع 151', en: 'Leaf Spring 151' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Leaf Spring 151',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009275',
        label: { ar: 'أزرق سماي 160', en: 'Blue Baby 160' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Blue Baby 160',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009276',
        label: { ar: 'أزرق سماوي 161', en: 'Blue Sky 161' },
        price: 45,
        stock: 100,
        attributes: { color: 'Blue Sky 161', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009277',
        label: { ar: 'رمادي فاتح 170', en: 'Gray Light 170' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Gray Light 170',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300971',
        label: { ar: 'رمادي بلاتيني 171', en: 'Grey Platinium 171' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Grey Platinium 171',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009278',
        label: { ar: 'رمادي غامق 172', en: 'Gray Ash 172' },
        price: 45,
        stock: 100,
        attributes: { color: 'Gray Ash 172', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009279',
        label: { ar: 'فحمي 173', en: 'Charcoal 173' },
        price: 45,
        stock: 100,
        attributes: { color: 'Charcoal 173', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009280',
        label: { ar: 'أسود 180', en: 'Black 180' },
        price: 45,
        stock: 100,
        attributes: { color: 'Black 180', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009281',
        label: { ar: 'صخري 227', en: 'Rock Desert 227' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Rock Desert 227',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009282',
        label: { ar: 'بني 228', en: 'Brown 228' },
        price: 45,
        stock: 100,
        attributes: { color: 'Brown 228', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009283',
        label: { ar: 'صحراوي 233', en: 'Sahara 233' },
        price: 45,
        stock: 100,
        attributes: { color: 'Sahara 233', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009284',
        label: { ar: 'رمادي حريري 274', en: 'Grey Silk 274' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Grey Silk 274',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009285',
        label: { ar: 'رمادي حجري 275', en: 'Grey Pebble 275' },
        price: 45,
        stock: 100,
        attributes: {
          color: 'Grey Pebble 275',
          weight: { value: 5, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Weber Epox Easy (ترويبة إيبوكسي ايزي 4 كغ)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    title: {
      ar: 'سودامكو ويبر ايبوكس ايزي ترويبة ايبوكسي 4 كغ',
      en: 'Sodamco Weber Epox Easy Epoxy Grout 4 KG',
    },
    slug: 'weber-epox-easy-4kg',
    description: {
      ar: 'ترويبة إيبوكسي عالية المقاومة الكيميائية وسهلة التطبيق والتنظيف، مثالية للأماكن ذات المتطلبات الصحية العالية والمسابح والمطابخ الصناعية.',
      en: 'High chemical resistance, easy-to-apply epoxy tile grout, ideal for sterile environments, commercial pools, and industrial kitchens.',
    },
    subCategorySlug: 'tile-grouts-adhesives',
    allowedAttributes: [
      {
        name: 'color',
        type: 'string',
        allowedValues: [
          'White Jasmine 110',
          'Ivory 120',
          'Beige 121',
          'Clay 122',
          'Cappuccino 123',
          'Terractta 124',
          'Chestnut 125',
          'Chocolate 126',
          'Yellow Pastel 130',
          'Chamomile 131',
          'Mustard 132',
          'Pink Baby 140',
          'Pink Antique 141',
          'Cherry 142',
          'Mint Fresh 150',
          'Leaf Spring 151',
          'Blue Baby 160',
          'Blue Sky 161',
          'Gray Light 170',
          'Grey Platinium 171',
          'Gray Ash 172',
          'Charcoal 173',
          'Black 180',
          'Desert Rock 227',
          'Brown 228',
          'Sahara 233',
          'Gray Silk 274',
          'Gray Pebble 275',
        ],
      },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['4'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300982',
        label: { ar: 'أبيض ياسمين 110', en: 'White Jasmine 110' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'White Jasmine 110',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009167',
        label: { ar: 'عاجي 120', en: 'Ivory 120' },
        price: 180,
        stock: 100,
        attributes: { color: 'Ivory 120', weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300983',
        label: { ar: 'بيج 121', en: 'Beige 121' },
        price: 180,
        stock: 100,
        attributes: { color: 'Beige 121', weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009169',
        label: { ar: 'طيني 122', en: 'Clay 122' },
        price: 180,
        stock: 100,
        attributes: { color: 'Clay 122', weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009170',
        label: { ar: 'كابتشينو 123', en: 'Cappuccino 123' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Cappuccino 123',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009171',
        label: { ar: 'تيراكوتا 124', en: 'Terractta 124' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Terractta 124',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009172',
        label: { ar: 'كستنائي 125', en: 'Chestnut 125' },
        price: 180,
        stock: 100,
        attributes: { color: 'Chestnut 125', weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009183',
        label: { ar: 'شوكولاتة 126', en: 'Chocolate 126' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Chocolate 126',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009173',
        label: { ar: 'أصفر باستيل 130', en: 'Yellow Pastel 130' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Yellow Pastel 130',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009174',
        label: { ar: 'بابونج 131', en: 'Chamomile 131' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Chamomile 131',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009176',
        label: { ar: 'خردل 132', en: 'Mustard 132' },
        price: 180,
        stock: 100,
        attributes: { color: 'Mustard 132', weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009179',
        label: { ar: 'وردي فاتح 140', en: 'Pink Baby 140' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Pink Baby 140',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009180',
        label: { ar: 'وردي عتيق 141', en: 'Pink Antique 141' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Pink Antique 141',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009181',
        label: { ar: 'كرزي 142', en: 'Cherry 142' },
        price: 180,
        stock: 100,
        attributes: { color: 'Cherry 142', weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009177',
        label: { ar: 'نعناع طازج 150', en: 'Mint Fresh 150' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Mint Fresh 150',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009178',
        label: { ar: 'ورقة الربيع 151', en: 'Leaf Spring 151' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Leaf Spring 151',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009182',
        label: { ar: 'أزرق سماي 160', en: 'Blue Baby 160' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Blue Baby 160',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300984',
        label: { ar: 'أزرق سماوي 161', en: 'Blue Sky 161' },
        price: 180,
        stock: 100,
        attributes: { color: 'Blue Sky 161', weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009184',
        label: { ar: 'رمادي فاتح 170', en: 'Gray Light 170' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Gray Light 170',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300985',
        label: { ar: 'رمادي بلاتيني 171', en: 'Grey Platinium 171' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Grey Platinium 171',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009185',
        label: { ar: 'رمادي غامق 172', en: 'Gray Ash 172' },
        price: 180,
        stock: 100,
        attributes: { color: 'Gray Ash 172', weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009186',
        label: { ar: 'فحمي 173', en: 'Charcoal 173' },
        price: 180,
        stock: 100,
        attributes: { color: 'Charcoal 173', weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300986',
        label: { ar: 'أسود 180', en: 'Black 180' },
        price: 180,
        stock: 100,
        attributes: { color: 'Black 180', weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009187',
        label: { ar: 'صخري 227', en: 'Desert Rock 227' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Desert Rock 227',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300987',
        label: { ar: 'بني 228', en: 'Brown 228' },
        price: 180,
        stock: 100,
        attributes: { color: 'Brown 228', weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009175',
        label: { ar: 'صحراوي 233', en: 'Sahara 233' },
        price: 180,
        stock: 100,
        attributes: { color: 'Sahara 233', weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009189',
        label: { ar: 'رمادي حريري 274', en: 'Gray Silk 274' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Gray Silk 274',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009190',
        label: { ar: 'رمادي حصوي 275', en: 'Gray Pebble 275' },
        price: 180,
        stock: 100,
        attributes: {
          color: 'Gray Pebble 275',
          weight: { value: 4, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Weber Floor Epo Bat (إيبوكسي أرضيات 14 كغ و 24 كغ)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    title: {
      ar: 'سودامكو ويبر فلور ايبو بات إيبوكسي أرضيات A+B',
      en: 'Sodamco Weber Floor Epo Bat Epoxy Flooring A+B',
    },
    slug: 'weber-floor-epo-bat',
    description: {
      ar: 'طلاء إيبوكسي صناعي ملون عالي الأداء للأرضيات الخرسانية والمصانع ومواقف السيارات، مقاوم للاحتكاك والمواد الكيميائية (مركب A+B).',
      en: 'High performance solvent-free colored epoxy flooring coating for industrial floors, warehouses, and car parks (A+B components).',
    },
    subCategorySlug: 'flooring-epoxies',
    allowedAttributes: [
      {
        name: 'color',
        type: 'string',
        allowedValues: [
          'Ivory Fossil 1014',
          'Ivory Light 1015',
          'Yellow Zinc 1018',
          'Beige Pottery 1019',
          'Antique Brick 3007',
          'Red Imperial 3020',
          'Blue Light 5012',
          'Green Emerald 6001',
          'Green Nature 6032',
          'Grey Pebble 7036',
          'Grey Dusty 7037',
          'Grey Dolphin 7040',
          'Grey Smoke 7045',
          'Grey Elephant 7046',
          'Grey 7047',
          'White 9003',
          'Black 9004',
        ],
      },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['14', '24'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009199',
        label: { ar: 'بيج غامق 1014 - 14 كغ', en: 'Ivory Fossil 1014 - 14 KG' },
        price: 390,
        stock: 50,
        attributes: {
          color: 'Ivory Fossil 1014',
          weight: { value: 14, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 14000,
          packageType: PackageType.GALLON,
        },
        components: [
          { name: 'A', value: 10.5, unit: 'kg' },
          { name: 'B', value: 3.5, unit: 'kg' },
        ],
      },
      {
        sku: '202300902',
        label: { ar: 'بيج غامق 1014 - 24 كغ', en: 'Ivory Fossil 1014 - 24 KG' },
        price: 620,
        stock: 50,
        attributes: {
          color: 'Ivory Fossil 1014',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: { weightGrams: 24000, packageType: PackageType.DRUM },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009200',
        label: { ar: 'بيج فاتح 1015 - 14 كغ', en: 'Ivory Light 1015 - 14 KG' },
        price: 390,
        stock: 50,
        attributes: {
          color: 'Ivory Light 1015',
          weight: { value: 14, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 14000,
          packageType: PackageType.GALLON,
        },
        components: [
          { name: 'A', value: 10.5, unit: 'kg' },
          { name: 'B', value: 3.5, unit: 'kg' },
        ],
      },
      {
        sku: '2023009214',
        label: { ar: 'بيج فاتح 1015 - 24 كغ', en: 'Ivory Light 1015 - 24 KG' },
        price: 620,
        stock: 50,
        attributes: {
          color: 'Ivory Light 1015',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: { weightGrams: 24000, packageType: PackageType.DRUM },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009204',
        label: {
          ar: 'أحمر إمبراطوري 3020 - 14 كغ',
          en: 'Red Imperial 3020 - 14 KG',
        },
        price: 410,
        stock: 50,
        attributes: {
          color: 'Red Imperial 3020',
          weight: { value: 14, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 14000,
          packageType: PackageType.GALLON,
        },
        components: [
          { name: 'A', value: 10.5, unit: 'kg' },
          { name: 'B', value: 3.5, unit: 'kg' },
        ],
      },
      {
        sku: '2023009217',
        label: {
          ar: 'أحمر إمبراطوري 3020 - 24 كغ',
          en: 'Red Imperial 3020 - 24 KG',
        },
        price: 650,
        stock: 50,
        attributes: {
          color: 'Red Imperial 3020',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: { weightGrams: 24000, packageType: PackageType.DRUM },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009205',
        label: { ar: 'أزرق فاتح 5012 - 14 كغ', en: 'Blue Light 5012 - 14 KG' },
        price: 410,
        stock: 50,
        attributes: {
          color: 'Blue Light 5012',
          weight: { value: 14, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 14000,
          packageType: PackageType.GALLON,
        },
        components: [
          { name: 'A', value: 10.5, unit: 'kg' },
          { name: 'B', value: 3.5, unit: 'kg' },
        ],
      },
      {
        sku: '2023009218',
        label: { ar: 'أزرق فاتح 5012 - 24 كغ', en: 'Blue Light 5012 - 24 KG' },
        price: 650,
        stock: 50,
        attributes: {
          color: 'Blue Light 5012',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: { weightGrams: 24000, packageType: PackageType.DRUM },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '202300924',
        label: {
          ar: 'رمادي دولفين 7040 - 14 كغ',
          en: 'Grey Dolphin 7040 - 14 KG',
        },
        price: 390,
        stock: 50,
        attributes: {
          color: 'Grey Dolphin 7040',
          weight: { value: 14, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 14000,
          packageType: PackageType.GALLON,
        },
        components: [
          { name: 'A', value: 10.5, unit: 'kg' },
          { name: 'B', value: 3.5, unit: 'kg' },
        ],
      },
      {
        sku: '2023009223',
        label: {
          ar: 'رمادي دولفين 7040 - 24 كغ',
          en: 'Grey Dolphin 7040 - 24 KG',
        },
        price: 620,
        stock: 50,
        attributes: {
          color: 'Grey Dolphin 7040',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: { weightGrams: 24000, packageType: PackageType.DRUM },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009212',
        label: { ar: 'أبيض 9003 - 14 كغ', en: 'White 9003 - 14 KG' },
        price: 390,
        stock: 50,
        attributes: { color: 'White 9003', weight: { value: 14, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 14000,
          packageType: PackageType.GALLON,
        },
        components: [
          { name: 'A', value: 10.5, unit: 'kg' },
          { name: 'B', value: 3.5, unit: 'kg' },
        ],
      },
      {
        sku: '2023009229',
        label: { ar: 'أبيض 9003 - 24 كغ', en: 'White 9003 - 24 KG' },
        price: 620,
        stock: 50,
        attributes: { color: 'White 9003', weight: { value: 24, unit: 'kg' } },
        shippingProfile: { weightGrams: 24000, packageType: PackageType.DRUM },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009213',
        label: { ar: 'أسود 9004 - 14 كغ', en: 'Black 9004 - 14 KG' },
        price: 390,
        stock: 50,
        attributes: { color: 'Black 9004', weight: { value: 14, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 14000,
          packageType: PackageType.GALLON,
        },
        components: [
          { name: 'A', value: 10.5, unit: 'kg' },
          { name: 'B', value: 3.5, unit: 'kg' },
        ],
      },
      {
        sku: '2023009227',
        label: { ar: 'أسود 9004 - 24 كغ', en: 'Black 9004 - 24 KG' },
        price: 620,
        stock: 50,
        attributes: { color: 'Black 9004', weight: { value: 24, unit: 'kg' } },
        shippingProfile: { weightGrams: 24000, packageType: PackageType.DRUM },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Weber Backing Rod (فلين فواصل التمدد)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    title: {
      ar: 'سودامكو ويبر باكب رود فلين فواصل تمدد',
      en: 'Sodamco Weber Backing Rod Expansion Joint Foam',
    },
    slug: 'weber-backing-rod',
    description: {
      ar: 'حبال فلين بولي إيثيلين دائرية مسامية مغلقة تدعم مانع تسرب الفواصل وتحدد العمق المناسب لمعجون السيلكون أو البولي يوريثان.',
      en: 'Closed-cell polyethylene foam backer rod designed to control sealant depth and prevent three-point adhesion in joint applications.',
    },
    subCategorySlug: 'expansion-joints-sealants',
    allowedAttributes: [
      {
        name: 'diameter',
        type: 'number',
        allowedValues: ['10', '15', '20', '25', '30', '40', '50'],
        allowedUnits: ['mm'],
      },
      {
        name: 'length',
        type: 'number',
        allowedValues: ['100', '200', '360', '800'],
        allowedUnits: ['m'],
      },
    ],
    variants: [
      {
        sku: '2023009122',
        label: { ar: '10 مم (800 متر)', en: '10 mm (800 m)' },
        price: 320,
        stock: 40,
        attributes: {
          diameter: { value: 10, unit: 'mm' },
          length: { value: 800, unit: 'm' },
        },
        shippingProfile: {
          weightGrams: 4500,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009296',
        label: { ar: '15 مم (360 متر)', en: '15 mm (360 m)' },
        price: 290,
        stock: 40,
        attributes: {
          diameter: { value: 15, unit: 'mm' },
          length: { value: 360, unit: 'm' },
        },
        shippingProfile: {
          weightGrams: 4200,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009297',
        label: { ar: '20 مم (200 متر)', en: '20 mm (200 m)' },
        price: 260,
        stock: 40,
        attributes: {
          diameter: { value: 20, unit: 'mm' },
          length: { value: 200, unit: 'm' },
        },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009298',
        label: { ar: '25 مم (100 متر)', en: '25 mm (100 m)' },
        price: 210,
        stock: 40,
        attributes: {
          diameter: { value: 25, unit: 'mm' },
          length: { value: 100, unit: 'm' },
        },
        shippingProfile: {
          weightGrams: 3500,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009299',
        label: { ar: '30 مم (100 متر)', en: '30 mm (100 m)' },
        price: 240,
        stock: 40,
        attributes: {
          diameter: { value: 30, unit: 'mm' },
          length: { value: 100, unit: 'm' },
        },
        shippingProfile: {
          weightGrams: 3800,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009300',
        label: { ar: '40 مم (100 متر)', en: '40 mm (100 m)' },
        price: 310,
        stock: 40,
        attributes: {
          diameter: { value: 40, unit: 'mm' },
          length: { value: 100, unit: 'm' },
        },
        shippingProfile: {
          weightGrams: 4800,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009301',
        label: { ar: '50 مم (100 متر)', en: '50 mm (100 m)' },
        price: 380,
        stock: 40,
        attributes: {
          diameter: { value: 50, unit: 'mm' },
          length: { value: 100, unit: 'm' },
        },
        shippingProfile: {
          weightGrams: 5500,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Weber Filler Board (فيلر بورد فواصل خرسانية)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    title: {
      ar: 'سودامكو ويبر فيلر بورد 2.20 * 1.22 متر',
      en: 'Sodamco Weber Filler Board 2.20 * 1.22 M',
    },
    slug: 'weber-filler-board',
    description: {
      ar: 'ألواح ألياف خشبية طبيعية مشبعة بالبيتومين لملء فواصل التمدد الإنشائية في الخرسانة والطرق والجسور والأرضيات.',
      en: 'Bitumen-impregnated fiberboard expansion joint filler for concrete pavements, roads, bridges, and structural expansion joints.',
    },
    subCategorySlug: 'expansion-joints-sealants',
    allowedAttributes: [
      {
        name: 'thickness',
        type: 'number',
        allowedValues: ['10', '12', '18', '25'],
        allowedUnits: ['mm'],
      },
    ],
    variants: [
      {
        sku: '2023009191',
        label: { ar: '10 مم (2.20 * 1.22 م)', en: '10 mm (2.20 * 1.22 M)' },
        price: 65,
        stock: 200,
        attributes: { thickness: { value: 10, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 6500,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 2200, widthMm: 1220, heightMm: 10 },
        },
      },
      {
        sku: '2023009192',
        label: { ar: '12 مم (2.20 * 1.22 م)', en: '12 mm (2.20 * 1.22 M)' },
        price: 78,
        stock: 200,
        attributes: { thickness: { value: 12, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 7800,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 2200, widthMm: 1220, heightMm: 12 },
        },
      },
      {
        sku: '2023009193',
        label: { ar: '18 مم (2.20 * 1.22 م)', en: '18 mm (2.20 * 1.22 M)' },
        price: 110,
        stock: 200,
        attributes: { thickness: { value: 18, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 11500,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 2200, widthMm: 1220, heightMm: 18 },
        },
      },
      {
        sku: '2023009194',
        label: { ar: '25 مم (2.20 * 1.22 م)', en: '25 mm (2.20 * 1.22 M)' },
        price: 145,
        stock: 200,
        attributes: { thickness: { value: 25, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 16000,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 2200, widthMm: 1220, heightMm: 25 },
        },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Weber Dry Cementitious Waterproofing (عوازل دراي أسمنتية)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    title: {
      ar: 'سودامكو ويبر دراي عازل أسمنتي فلكس',
      en: 'Sodamco Weber Dry Cementitious Waterproofing',
    },
    slug: 'weber-dry-cementitious',
    description: {
      ar: 'عازل مائي أسمنتي مطاطي معدل بالبوليمر من مركبين لعزل الخزانات، المسابح، الأساسات، والمطابخ والحمامات.',
      en: 'Flexible two-component polymer-modified cementitious waterproofing coating for water tanks, pools, foundations, and wet areas.',
    },
    subCategorySlug: 'waterproofing-protection',
    allowedAttributes: [
      {
        name: 'color',
        type: 'string',
        allowedValues: ['Gray', 'White', 'Blue'],
      },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['15', '19.5', '26', '30', '32.5'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300951',
        label: {
          ar: 'دراي 100 اف اكس رمادي 19.5 كغ',
          en: 'Dry 100 FX Grey 19.5 KG',
        },
        price: 115,
        stock: 80,
        attributes: { color: 'Gray', weight: { value: 19.5, unit: 'kg' } },
        shippingProfile: { weightGrams: 19500, packageType: PackageType.BAG },
        components: [
          { name: 'A', value: 15, unit: 'kg' },
          { name: 'B', value: 4.5, unit: 'kg' },
        ],
      },
      {
        sku: '202300909',
        label: {
          ar: 'دراي 100 اف اكس رمادي 26 كغ',
          en: 'Dry 100 FX Grey 26 KG',
        },
        price: 145,
        stock: 80,
        attributes: { color: 'Gray', weight: { value: 26, unit: 'kg' } },
        shippingProfile: { weightGrams: 26000, packageType: PackageType.BAG },
        components: [
          { name: 'A', value: 20, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '202300953',
        label: {
          ar: 'دراي 100 اف اكس رمادي 32.5 كغ',
          en: 'Dry 100 FX Grey 32.5 KG',
        },
        price: 180,
        stock: 80,
        attributes: { color: 'Gray', weight: { value: 32.5, unit: 'kg' } },
        shippingProfile: { weightGrams: 32500, packageType: PackageType.BAG },
        components: [
          { name: 'A', value: 25, unit: 'kg' },
          { name: 'B', value: 7.5, unit: 'kg' },
        ],
      },
      {
        sku: '202300903',
        label: {
          ar: 'دراي 110 اف اكس رمادي 30 كغ',
          en: 'Dry 110 FX Grey 30 KG',
        },
        price: 165,
        stock: 80,
        attributes: { color: 'Gray', weight: { value: 30, unit: 'kg' } },
        shippingProfile: { weightGrams: 30000, packageType: PackageType.BAG },
        components: [
          { name: 'A', value: 20, unit: 'kg' },
          { name: 'B', value: 10, unit: 'kg' },
        ],
      },
      {
        sku: '2023009130',
        label: {
          ar: 'دراي 110 اف اكس أبيض 30 كغ',
          en: 'Dry 110 FX White 30 KG',
        },
        price: 175,
        stock: 80,
        attributes: { color: 'White', weight: { value: 30, unit: 'kg' } },
        shippingProfile: { weightGrams: 30000, packageType: PackageType.BAG },
        components: [
          { name: 'A', value: 20, unit: 'kg' },
          { name: 'B', value: 10, unit: 'kg' },
        ],
      },
      {
        sku: '202300950',
        label: {
          ar: 'دراي 110 اف اكس أزرق 30 كغ',
          en: 'Dry 110 FX Blue 30 KG',
        },
        price: 185,
        stock: 80,
        attributes: { color: 'Blue', weight: { value: 30, unit: 'kg' } },
        shippingProfile: { weightGrams: 30000, packageType: PackageType.BAG },
        components: [
          { name: 'A', value: 20, unit: 'kg' },
          { name: 'B', value: 10, unit: 'kg' },
        ],
      },
      {
        sku: '202300945',
        label: {
          ar: 'دراي 130 بي ار رمادي 32.5 كغ',
          en: 'Dry 130 PR Grey 32.5 KG',
        },
        price: 195,
        stock: 80,
        attributes: { color: 'Gray', weight: { value: 32.5, unit: 'kg' } },
        shippingProfile: { weightGrams: 32500, packageType: PackageType.BAG },
        components: [
          { name: 'A', value: 25, unit: 'kg' },
          { name: 'B', value: 7.5, unit: 'kg' },
        ],
      },
      {
        sku: '202300946',
        label: {
          ar: 'دراي 130 بي ار أبيض 32.5 كغ',
          en: 'Dry 130 PR White 32.5 KG',
        },
        price: 205,
        stock: 80,
        attributes: { color: 'White', weight: { value: 32.5, unit: 'kg' } },
        shippingProfile: { weightGrams: 32500, packageType: PackageType.BAG },
        components: [
          { name: 'A', value: 25, unit: 'kg' },
          { name: 'B', value: 7.5, unit: 'kg' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Weber Joint Seal PU 300 / MC (معجون فواصل بولي يوريثان 600 مل)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    title: {
      ar: 'سودامكو ويبر جوينت سيل بولي يوريثان 600 مل',
      en: 'Sodamco Weber Joint Seal PU 600 ML',
    },
    slug: 'weber-joint-seal-pu',
    description: {
      ar: 'معجون بولي يوريثان مطاطي عالي الجودة لمعالجة فواصل التمدد والفواصل الإنشائية في الخرسانة والأرضيات والواجهات.',
      en: 'High-performance elastomeric polyurethane sealant designed for expansion and construction joints in concrete and precast panels.',
    },
    subCategorySlug: 'expansion-joints-sealants',
    allowedAttributes: [
      {
        name: 'color',
        type: 'string',
        allowedValues: ['White', 'Grey', 'Beige'],
      },
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['600'],
        allowedUnits: ['ml'],
      },
    ],
    variants: [
      {
        sku: '202300942',
        label: { ar: 'بي يو 300 أبيض 600 مل', en: 'PU 300 White 600 ML' },
        price: 28,
        stock: 300,
        attributes: { color: 'White', volume: { value: 600, unit: 'ml' } },
        shippingProfile: {
          weightGrams: 850,
          packageType: PackageType.PIECE,
          quantityPerPackage: 20,
        },
      },
      {
        sku: '202300916',
        label: { ar: 'بي يو 300 رمادي 600 مل', en: 'PU 300 Grey 600 ML' },
        price: 28,
        stock: 300,
        attributes: { color: 'Grey', volume: { value: 600, unit: 'ml' } },
        shippingProfile: {
          weightGrams: 850,
          packageType: PackageType.PIECE,
          quantityPerPackage: 20,
        },
      },
      {
        sku: '202300943',
        label: { ar: 'بي يو 300 بيج 600 مل', en: 'PU 300 Beige 600 ML' },
        price: 28,
        stock: 300,
        attributes: { color: 'Beige', volume: { value: 600, unit: 'ml' } },
        shippingProfile: {
          weightGrams: 850,
          packageType: PackageType.PIECE,
          quantityPerPackage: 20,
        },
      },
      {
        sku: '202300997',
        label: { ar: 'بي يو ام سي أبيض 600 مل', en: 'PU MC White 600 ML' },
        price: 32,
        stock: 300,
        attributes: { color: 'White', volume: { value: 600, unit: 'ml' } },
        shippingProfile: {
          weightGrams: 850,
          packageType: PackageType.PIECE,
          quantityPerPackage: 20,
        },
      },
      {
        sku: '202300988',
        label: { ar: 'بي يو ام سي رمادي 600 مل', en: 'PU MC Gray 600 ML' },
        price: 32,
        stock: 300,
        attributes: { color: 'Grey', volume: { value: 600, unit: 'ml' } },
        shippingProfile: {
          weightGrams: 850,
          packageType: PackageType.PIECE,
          quantityPerPackage: 20,
        },
      },
      {
        sku: '202300996',
        label: { ar: 'بي يو ام سي بيج 600 مل', en: 'PU MC Beige 600 ML' },
        price: 32,
        stock: 300,
        attributes: { color: 'Beige', volume: { value: 600, unit: 'ml' } },
        shippingProfile: {
          weightGrams: 850,
          packageType: PackageType.PIECE,
          quantityPerPackage: 20,
        },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Weber Col Tile Adhesives (غراء بلاط وسيراميك)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    title: {
      ar: 'سودامكو ويبر كول غراء بلاط وبورسلان وسيراميك',
      en: 'Sodamco Weber Col Tile & Porcelain Adhesives',
    },
    slug: 'weber-col-tile-adhesives',
    description: {
      ar: 'تشكيلة متكاملة من غراء البلاط والبورسلان الإسمنتي عالي الالتصاق والمقاوم للانزلاق للاستخدامات الداخلية والخارجية.',
      en: 'Comprehensive range of high performance polymer-modified cementitious adhesives for ceramic, porcelain, and natural stone tiles.',
    },
    subCategorySlug: 'tile-grouts-adhesives',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['Grey', 'White'] },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300931',
        label: { ar: 'سيرافيكس رمادي 20 كغ', en: 'Cerafix Grey 20 KG' },
        price: 26,
        stock: 150,
        attributes: { color: 'Grey', weight: { value: 20, unit: 'kg' } },
        shippingProfile: { weightGrams: 20000, packageType: PackageType.BAG },
      },
      {
        sku: '202300929',
        label: { ar: 'سيرافيكس أبيض 20 كغ', en: 'Cerafix White 20 KG' },
        price: 32,
        stock: 150,
        attributes: { color: 'White', weight: { value: 20, unit: 'kg' } },
        shippingProfile: { weightGrams: 20000, packageType: PackageType.BAG },
      },
      {
        sku: '2023009121',
        label: { ar: 'كول فيكس رمادي 20 كغ', en: 'Col Fix Grey 20 KG' },
        price: 35,
        stock: 150,
        attributes: { color: 'Grey', weight: { value: 20, unit: 'kg' } },
        shippingProfile: { weightGrams: 20000, packageType: PackageType.BAG },
      },
      {
        sku: '2023009120',
        label: { ar: 'كول فيكس أبيض 20 كغ', en: 'Col Fix White 20 KG' },
        price: 42,
        stock: 150,
        attributes: { color: 'White', weight: { value: 20, unit: 'kg' } },
        shippingProfile: { weightGrams: 20000, packageType: PackageType.BAG },
      },
      {
        sku: '2023009231',
        label: { ar: 'كول بلس رمادي 20 كغ', en: 'Col Plus Grey 20 KG' },
        price: 48,
        stock: 150,
        attributes: { color: 'Grey', weight: { value: 20, unit: 'kg' } },
        shippingProfile: { weightGrams: 20000, packageType: PackageType.BAG },
      },
      {
        sku: '202300989',
        label: { ar: 'كول بلس أبيض 20 كغ', en: 'Col Plus White 20 KG' },
        price: 56,
        stock: 150,
        attributes: { color: 'White', weight: { value: 20, unit: 'kg' } },
        shippingProfile: { weightGrams: 20000, packageType: PackageType.BAG },
      },
      {
        sku: '2023009111',
        label: { ar: 'كول كي رمادي 20 كغ', en: 'Col K Grey 20 KG' },
        price: 40,
        stock: 150,
        attributes: { color: 'Grey', weight: { value: 20, unit: 'kg' } },
        shippingProfile: { weightGrams: 20000, packageType: PackageType.BAG },
      },
      {
        sku: '202300933',
        label: { ar: 'كول كي أبيض 20 كغ', en: 'Col K White 20 KG' },
        price: 47,
        stock: 150,
        attributes: { color: 'White', weight: { value: 20, unit: 'kg' } },
        shippingProfile: { weightGrams: 20000, packageType: PackageType.BAG },
      },
      {
        sku: '2023009106',
        label: {
          ar: 'كول فليكس أبيض 19.5 كغ A+B',
          en: 'Col Flex White 19.5 KG A+B',
        },
        price: 110,
        stock: 100,
        attributes: { color: 'White', weight: { value: 19.5, unit: 'kg' } },
        shippingProfile: { weightGrams: 19500, packageType: PackageType.BAG },
        components: [
          { name: 'A (Powder)', value: 15, unit: 'kg' },
          { name: 'B (Liquid)', value: 4.5, unit: 'kg' },
        ],
      },
      {
        sku: '2023009149',
        label: {
          ar: 'كول بريميوم اف رمادي 20 كغ + 4.8 لتر',
          en: 'Col Premium F Grey 20 KG + 4.8 L',
        },
        price: 135,
        stock: 100,
        attributes: { color: 'Grey', weight: { value: 24.8, unit: 'kg' } },
        shippingProfile: { weightGrams: 24800, packageType: PackageType.BAG },
        components: [
          { name: 'Powder', value: 20, unit: 'kg' },
          { name: 'Liquid', value: 4.8, unit: 'ltr' },
        ],
      },
      {
        sku: '2023009105',
        label: {
          ar: 'كول بريميوم اف أبيض 20 كغ + 4.8 لتر',
          en: 'Col Premium F White 20 KG + 4.8 L',
        },
        price: 145,
        stock: 100,
        attributes: { color: 'White', weight: { value: 24.8, unit: 'kg' } },
        shippingProfile: { weightGrams: 24800, packageType: PackageType.BAG },
        components: [
          { name: 'Powder', value: 20, unit: 'kg' },
          { name: 'Liquid', value: 4.8, unit: 'ltr' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Weber Concrete Repair (معالجة الخرسانة والتعشيش)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    title: {
      ar: 'سودامكو ويبر ريب مونة معالجة تعشيش الخرسانة',
      en: 'Sodamco Weber Rep Concrete Repair Mortars',
    },
    slug: 'weber-rep-concrete-repair',
    description: {
      ar: 'مونة إسمنتية وإيبوكسية غير قابلة للانكماش ومقواة بالألياف لمعالجة تعشيش وتآكل الخرسانة الإنشائية وإعادة تأهيلها.',
      en: 'Fiber-reinforced non-shrink structural concrete repair mortars for patching, cosmetic, and load-bearing concrete restoration.',
    },
    subCategorySlug: 'concrete-repair-grouts',
    allowedAttributes: [
      {
        name: 'type',
        type: 'string',
        allowedValues: [
          'Coarse 331 TX',
          'Fine 332 FR',
          'Fine 360 FFR',
          'Fine PC',
          'Coarse ST',
        ],
      },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['20', '25'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300901',
        label: {
          ar: 'ريب 331 تي اكس تعشيش خشن 25 كغ',
          en: 'Rep 331 TX Coarse 25 KG',
        },
        price: 55,
        stock: 120,
        attributes: {
          type: 'Coarse 331 TX',
          weight: { value: 25, unit: 'kg' },
        },
        shippingProfile: { weightGrams: 25000, packageType: PackageType.BAG },
      },
      {
        sku: '202300952',
        label: {
          ar: 'ريب 332 اف ار تعشيش ناعم 25 كغ',
          en: 'Rep 332 FR Fine 25 KG',
        },
        price: 60,
        stock: 120,
        attributes: { type: 'Fine 332 FR', weight: { value: 25, unit: 'kg' } },
        shippingProfile: { weightGrams: 25000, packageType: PackageType.BAG },
      },
      {
        sku: '202300904',
        label: {
          ar: 'ريب 360 اف اف ار تعشيش ناعم 20 كغ',
          en: 'Rep 360 FFR Fine 20 KG',
        },
        price: 65,
        stock: 120,
        attributes: { type: 'Fine 360 FFR', weight: { value: 20, unit: 'kg' } },
        shippingProfile: { weightGrams: 20000, packageType: PackageType.BAG },
      },
      {
        sku: '2023009151',
        label: { ar: 'ريب بي سي تعشيش ناعم 20 كغ', en: 'Rep PC Fine 20 KG' },
        price: 58,
        stock: 120,
        attributes: { type: 'Fine PC', weight: { value: 20, unit: 'kg' } },
        shippingProfile: { weightGrams: 20000, packageType: PackageType.BAG },
      },
      {
        sku: '2023009152',
        label: { ar: 'اس تي سي تعشيش خشن 20 كغ', en: 'ST Coarse 20 KG' },
        price: 52,
        stock: 120,
        attributes: { type: 'Coarse ST', weight: { value: 20, unit: 'kg' } },
        shippingProfile: { weightGrams: 20000, packageType: PackageType.BAG },
      },
      {
        sku: '202300949',
        label: {
          ar: 'تيك 301 جراوت غير قابل للانكماش 25 كغ',
          en: 'Tec 301 Non-Shrink Grout 25 KG',
        },
        price: 42,
        stock: 200,
        attributes: { weight: { value: 25, unit: 'kg' } },
        shippingProfile: { weightGrams: 25000, packageType: PackageType.BAG },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. Weber Floor Road Mark (دهان تخطيط الطرق)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    title: {
      ar: 'سودامكو ويبر فلور دهان تخطيط طرق ومواقف',
      en: 'Sodamco Weber Floor Road Marking Paint',
    },
    slug: 'weber-road-marking-paint',
    description: {
      ar: 'دهان ألكيدي سريع الجفاف عالي المقاومة للتآكل والعوامل الجوية لتخطيط الطرق والإسفلت ومواقف السيارات والمطارات.',
      en: 'Fast-drying high durability alkyd-based road marking paint for highways, asphalt streets, and commercial parking bays.',
    },
    subCategorySlug: 'flooring-epoxies',
    allowedAttributes: [
      {
        name: 'color',
        type: 'string',
        allowedValues: ['Black', 'White', 'Yellow'],
      },
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['3.6', '18'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009237',
        label: { ar: 'دهان طرق أسود 3.6 لتر', en: 'Road Mark Black 3.6 L' },
        price: 75,
        stock: 80,
        attributes: { color: 'Black', volume: { value: 3.6, unit: 'ltr' } },
        shippingProfile: { weightGrams: 4500, packageType: PackageType.GALLON },
      },
      {
        sku: '2023009239',
        label: { ar: 'دهان طرق أسود 18 لتر', en: 'Road Mark Black 18 L' },
        price: 290,
        stock: 40,
        attributes: { color: 'Black', volume: { value: 18, unit: 'ltr' } },
        shippingProfile: { weightGrams: 23000, packageType: PackageType.DRUM },
      },
      {
        sku: '2023009240',
        label: { ar: 'دهان طرق أبيض 3.6 لتر', en: 'Road Mark White 3.6 L' },
        price: 80,
        stock: 80,
        attributes: { color: 'White', volume: { value: 3.6, unit: 'ltr' } },
        shippingProfile: { weightGrams: 4500, packageType: PackageType.GALLON },
      },
      {
        sku: '2023009238',
        label: { ar: 'دهان طرق أبيض 18 لتر', en: 'Road Mark White 18 L' },
        price: 310,
        stock: 40,
        attributes: { color: 'White', volume: { value: 18, unit: 'ltr' } },
        shippingProfile: { weightGrams: 23000, packageType: PackageType.DRUM },
      },
      {
        sku: '2023009235',
        label: { ar: 'دهان طرق أصفر 3.6 لتر', en: 'Road Mark Yellow 3.6 L' },
        price: 85,
        stock: 80,
        attributes: { color: 'Yellow', volume: { value: 3.6, unit: 'ltr' } },
        shippingProfile: { weightGrams: 4500, packageType: PackageType.GALLON },
      },
      {
        sku: '2023009236',
        label: { ar: 'دهان طرق أصفر 18 لتر', en: 'Road Mark Yellow 18 L' },
        price: 325,
        stock: 40,
        attributes: { color: 'Yellow', volume: { value: 18, unit: 'ltr' } },
        shippingProfile: { weightGrams: 23000, packageType: PackageType.DRUM },
      },
    ],
  },
];
