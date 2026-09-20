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

export const WEBER_PRODUCTS_DATA: SeedProductFamily[] = [
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
    subCategorySlug: 'tile-adhesives-grouts',
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
    subCategorySlug: 'tile-adhesives-grouts',
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
    subCategorySlug: 'epoxy-flooring-tanks',
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
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
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
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
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
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
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
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
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
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
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
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
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
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009201',
        label: { ar: 'أصفر زنك 1018 - 14 كغ', en: 'Yellow Zinc 1018 - 14 KG' },
        price: 410,
        stock: 50,
        attributes: {
          color: 'Yellow Zinc 1018',
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
        sku: '2023009215',
        label: { ar: 'أصفر زنك 1018 - 24 كغ', en: 'Yellow Zinc 1018 - 24 KG' },
        price: 650,
        stock: 50,
        attributes: {
          color: 'Yellow Zinc 1018',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009202',
        label: {
          ar: 'بيج فخاري 1019 - 14 كغ',
          en: 'Beige Pottery 1019 - 14 KG',
        },
        price: 410,
        stock: 50,
        attributes: {
          color: 'Beige Pottery 1019',
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
        sku: '2023009216',
        label: {
          ar: 'بيج فخاري 1019 - 24 كغ',
          en: 'Beige Pottery 1019 - 24 KG',
        },
        price: 650,
        stock: 50,
        attributes: {
          color: 'Beige Pottery 1019',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009203',
        label: {
          ar: 'طوب عتيق 3007 - 14 كغ',
          en: 'Antique Brick 3007 - 14 KG',
        },
        price: 410,
        stock: 50,
        attributes: {
          color: 'Antique Brick 3007',
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
        sku: '2023009228',
        label: {
          ar: 'طوب عتيق 3007 - 24 كغ',
          en: 'Antique Brick 3007 - 24 KG',
        },
        price: 650,
        stock: 50,
        attributes: {
          color: 'Antique Brick 3007',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009206',
        label: {
          ar: 'أخضر زمرد 6001 - 14 كغ',
          en: 'Green Emerald 6001 - 14 KG',
        },
        price: 410,
        stock: 50,
        attributes: {
          color: 'Green Emerald 6001',
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
        sku: '2023009219',
        label: {
          ar: 'أخضر زمرد 6001 - 24 كغ',
          en: 'Green Emerald 6001 - 24 KG',
        },
        price: 650,
        stock: 50,
        attributes: {
          color: 'Green Emerald 6001',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009207',
        label: {
          ar: 'أخضر طبيعي 6032 - 14 كغ',
          en: 'Green Nature 6032 - 14 KG',
        },
        price: 410,
        stock: 50,
        attributes: {
          color: 'Green Nature 6032',
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
        sku: '2023009220',
        label: {
          ar: 'أخضر طبيعي 6032 - 24 كغ',
          en: 'Green Nature 6032 - 24 KG',
        },
        price: 650,
        stock: 50,
        attributes: {
          color: 'Green Nature 6032',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009198',
        label: { ar: 'رمادي حصى 7036 - 14 كغ', en: 'Grey Pebble 7036 - 14 KG' },
        price: 390,
        stock: 50,
        attributes: {
          color: 'Grey Pebble 7036',
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
        sku: '2023009221',
        label: { ar: 'رمادي حصى 7036 - 24 كغ', en: 'Grey Pebble 7036 - 24 KG' },
        price: 620,
        stock: 50,
        attributes: {
          color: 'Grey Pebble 7036',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009208',
        label: {
          ar: 'رمادي غباري 7037 - 14 كغ',
          en: 'Grey Dusty 7037 - 14 KG',
        },
        price: 390,
        stock: 50,
        attributes: {
          color: 'Grey Dusty 7037',
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
        sku: '2023009222',
        label: {
          ar: 'رمادي غباري 7037 - 24 كغ',
          en: 'Grey Dusty 7037 - 24 KG',
        },
        price: 620,
        stock: 50,
        attributes: {
          color: 'Grey Dusty 7037',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009209',
        label: {
          ar: 'رمادي دخاني 7045 - 14 كغ',
          en: 'Grey Smoke 7045 - 14 KG',
        },
        price: 390,
        stock: 50,
        attributes: {
          color: 'Grey Smoke 7045',
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
        sku: '2023009224',
        label: {
          ar: 'رمادي دخاني 7045 - 24 كغ',
          en: 'Grey Smoke 7045 - 24 KG',
        },
        price: 620,
        stock: 50,
        attributes: {
          color: 'Grey Smoke 7045',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009210',
        label: {
          ar: 'رمادي فيل 7046 - 14 كغ',
          en: 'Grey Elephant 7046 - 14 KG',
        },
        price: 390,
        stock: 50,
        attributes: {
          color: 'Grey Elephant 7046',
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
        sku: '2023009225',
        label: {
          ar: 'رمادي فيل 7046 - 24 كغ',
          en: 'Grey Elephant 7046 - 24 KG',
        },
        price: 620,
        stock: 50,
        attributes: {
          color: 'Grey Elephant 7046',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
      {
        sku: '2023009211',
        label: { ar: 'رمادي 7047 - 14 كغ', en: 'Grey 7047 - 14 KG' },
        price: 390,
        stock: 50,
        attributes: { color: 'Grey 7047', weight: { value: 14, unit: 'kg' } },
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
        sku: '2023009226',
        label: { ar: 'رمادي 7047 - 24 كغ', en: 'Grey 7047 - 24 KG' },
        price: 620,
        stock: 50,
        attributes: { color: 'Grey 7047', weight: { value: 24, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 24000,
          packageType: PackageType.DRUM,
        },
        components: [
          { name: 'A', value: 18, unit: 'kg' },
          { name: 'B', value: 6, unit: 'kg' },
        ],
      },
    ],
  },
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
    subCategorySlug: 'backing-rods',
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
        label: { ar: '10 مم (متر 800)', en: '10 mm (800 m)' },
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
        label: { ar: '15 مم (متر 360)', en: '15 mm (360 m)' },
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
        label: { ar: '20 مم (متر 200)', en: '20 mm (200 m)' },
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
        label: { ar: '25 مم (متر 100)', en: '25 mm (100 m)' },
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
        label: { ar: '30 مم (متر 100)', en: '30 mm (100 m)' },
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
        label: { ar: '40 مم (متر 100)', en: '40 mm (100 m)' },
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
        label: { ar: '50 مم (متر 100)', en: '50 mm (100 m)' },
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
    subCategorySlug: 'joint-sealants',
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
        },
      },
    ],
  },
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
    subCategorySlug: 'cementitious-waterproofing',
    allowedAttributes: [
      {
        name: 'type',
        type: 'string',
        allowedValues: [
          '100 FX Grey',
          '110 FX',
          '110 FX Grey',
          '110 FX HE Grey',
          '116 FX Grey',
          '130 PR',
          '130 PR Grey',
        ],
      },
      {
        name: 'color',
        type: 'string',
        allowedValues: ['Gray', 'White', 'Blue'],
      },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['15', '19.5', '25', '26', '30', '32.5'],
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
        attributes: {
          color: 'Gray',
          weight: { value: 19.5, unit: 'kg' },
          type: '100 FX Grey',
        },
        shippingProfile: {
          weightGrams: 19500,
          packageType: PackageType.BAG,
        },
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
        attributes: {
          color: 'Gray',
          weight: { value: 26, unit: 'kg' },
          type: '100 FX Grey',
        },
        shippingProfile: {
          weightGrams: 26000,
          packageType: PackageType.BAG,
        },
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
        attributes: {
          color: 'Gray',
          weight: { value: 32.5, unit: 'kg' },
          type: '100 FX Grey',
        },
        shippingProfile: {
          weightGrams: 32500,
          packageType: PackageType.BAG,
        },
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
        attributes: {
          color: 'Gray',
          weight: { value: 30, unit: 'kg' },
          type: '110 FX Grey',
        },
        shippingProfile: {
          weightGrams: 30000,
          packageType: PackageType.BAG,
        },
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
        attributes: {
          color: 'White',
          weight: { value: 30, unit: 'kg' },
          type: '110 FX',
        },
        shippingProfile: {
          weightGrams: 30000,
          packageType: PackageType.BAG,
        },
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
        attributes: {
          color: 'Blue',
          weight: { value: 30, unit: 'kg' },
          type: '110 FX',
        },
        shippingProfile: {
          weightGrams: 30000,
          packageType: PackageType.BAG,
        },
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
        attributes: {
          color: 'Gray',
          weight: { value: 32.5, unit: 'kg' },
          type: '130 PR Grey',
        },
        shippingProfile: {
          weightGrams: 32500,
          packageType: PackageType.BAG,
        },
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
        attributes: {
          color: 'White',
          weight: { value: 32.5, unit: 'kg' },
          type: '130 PR',
        },
        shippingProfile: {
          weightGrams: 32500,
          packageType: PackageType.BAG,
        },
        components: [
          { name: 'A', value: 25, unit: 'kg' },
          { name: 'B', value: 7.5, unit: 'kg' },
        ],
      },
      {
        sku: '2023009307',
        label: {
          ar: 'دراي 110 اف اكس اتش اي عازل إسمنتي رمادي 25 كغ',
          en: 'Dry 110 FX HE Grey 25 KG',
        },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Gray',
          weight: { value: 25, unit: 'kg' },
          type: '110 FX HE Grey',
        },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009132',
        label: {
          ar: 'دراي 116 اف اكس عازل إسمنتي رمادي 30 كغ',
          en: 'Dry 116 FX Grey 30 KG',
        },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Gray',
          weight: { value: 30, unit: 'kg' },
          type: '116 FX Grey',
        },
        shippingProfile: {
          weightGrams: 30000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009131',
        label: {
          ar: 'دراي 110 اف اكس عازل إسمنتي رمادي 15 كغ',
          en: 'Dry 110 FX Grey 15 KG',
        },
        price: 90,
        stock: 80,
        attributes: {
          color: 'Gray',
          weight: { value: 15, unit: 'kg' },
          type: '110 FX Grey',
        },
        shippingProfile: {
          weightGrams: 15000,
          packageType: PackageType.DRUM,
        },
        components: [
          { name: 'A', value: 11, unit: 'kg' },
          { name: 'B', value: 4, unit: 'kg' },
        ],
      },
    ],
  },
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
    subCategorySlug: 'joint-sealants',
    allowedAttributes: [
      { name: 'type', type: 'string', allowedValues: ['300', 'MC', 'MC Gray'] },
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
        attributes: {
          color: 'White',
          volume: { value: 600, unit: 'ml' },
          type: '300',
        },
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
        attributes: {
          color: 'Grey',
          volume: { value: 600, unit: 'ml' },
          type: '300',
        },
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
        attributes: {
          color: 'Beige',
          volume: { value: 600, unit: 'ml' },
          type: '300',
        },
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
        attributes: {
          color: 'White',
          volume: { value: 600, unit: 'ml' },
          type: 'MC',
        },
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
        attributes: {
          color: 'Grey',
          volume: { value: 600, unit: 'ml' },
          type: 'MC Gray',
        },
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
        attributes: {
          color: 'Beige',
          volume: { value: 600, unit: 'ml' },
          type: 'MC',
        },
        shippingProfile: {
          weightGrams: 850,
          packageType: PackageType.PIECE,
          quantityPerPackage: 20,
        },
      },
    ],
  },
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
    subCategorySlug: 'tile-adhesives-grouts',
    allowedAttributes: [
      {
        name: 'type',
        type: 'string',
        allowedValues: [
          'Cerafix',
          'Col Fix',
          'Col Flex A+B',
          'Col Floor Gray',
          'Col K',
          'Col Plus',
          'Col Premium',
          'Col Premium F 20 4.8',
          'Col Premium Gray',
          'Col Pro',
        ],
      },
      { name: 'color', type: 'string', allowedValues: ['Grey', 'White'] },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['19.5', '20', '24.8', '50'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300931',
        label: { ar: 'سيرافيكس رمادي 20 كغ', en: 'Cerafix Grey 20 KG' },
        price: 26,
        stock: 150,
        attributes: {
          color: 'Grey',
          weight: { value: 20, unit: 'kg' },
          type: 'Cerafix',
        },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
        },
      },
      {
        sku: '202300929',
        label: { ar: 'سيرافيكس أبيض 20 كغ', en: 'Cerafix White 20 KG' },
        price: 32,
        stock: 150,
        attributes: {
          color: 'White',
          weight: { value: 20, unit: 'kg' },
          type: 'Cerafix',
        },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
        },
      },
      {
        sku: '2023009121',
        label: { ar: 'كول فيكس رمادي 20 كغ', en: 'Col Fix Grey 20 KG' },
        price: 35,
        stock: 150,
        attributes: {
          color: 'Grey',
          weight: { value: 20, unit: 'kg' },
          type: 'Col Fix',
        },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
        },
      },
      {
        sku: '2023009120',
        label: { ar: 'كول فيكس أبيض 20 كغ', en: 'Col Fix White 20 KG' },
        price: 42,
        stock: 150,
        attributes: {
          color: 'White',
          weight: { value: 20, unit: 'kg' },
          type: 'Col Fix',
        },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
        },
      },
      {
        sku: '2023009231',
        label: { ar: 'كول بلس رمادي 20 كغ', en: 'Col Plus Grey 20 KG' },
        price: 48,
        stock: 150,
        attributes: {
          color: 'Grey',
          weight: { value: 20, unit: 'kg' },
          type: 'Col Plus',
        },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
        },
      },
      {
        sku: '202300989',
        label: { ar: 'كول بلس أبيض 20 كغ', en: 'Col Plus White 20 KG' },
        price: 56,
        stock: 150,
        attributes: {
          color: 'White',
          weight: { value: 20, unit: 'kg' },
          type: 'Col Plus',
        },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
        },
      },
      {
        sku: '2023009111',
        label: { ar: 'كول كي رمادي 20 كغ', en: 'Col K Grey 20 KG' },
        price: 40,
        stock: 150,
        attributes: {
          color: 'Grey',
          weight: { value: 20, unit: 'kg' },
          type: 'Col K',
        },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
        },
      },
      {
        sku: '202300933',
        label: { ar: 'كول كي أبيض 20 كغ', en: 'Col K White 20 KG' },
        price: 47,
        stock: 150,
        attributes: {
          color: 'White',
          weight: { value: 20, unit: 'kg' },
          type: 'Col K',
        },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
        },
      },
      {
        sku: '2023009106',
        label: {
          ar: 'كول فليكس أبيض 19.5 كغ A+B',
          en: 'Col Flex White 19.5 KG A+B',
        },
        price: 110,
        stock: 100,
        attributes: {
          color: 'White',
          weight: { value: 19.5, unit: 'kg' },
          type: 'Col Flex A+B',
        },
        shippingProfile: {
          weightGrams: 19500,
          packageType: PackageType.BAG,
        },
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
        attributes: {
          color: 'Grey',
          weight: { value: 24.8, unit: 'kg' },
          type: 'Col Premium F 20 4.8',
        },
        shippingProfile: {
          weightGrams: 24800,
          packageType: PackageType.BAG,
        },
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
        attributes: {
          color: 'White',
          weight: { value: 24.8, unit: 'kg' },
          type: 'Col Premium F 20 4.8',
        },
        shippingProfile: {
          weightGrams: 24800,
          packageType: PackageType.BAG,
        },
        components: [
          { name: 'Powder', value: 20, unit: 'kg' },
          { name: 'Liquid', value: 4.8, unit: 'ltr' },
        ],
      },
      {
        sku: '202300932',
        label: {
          ar: 'كول برو غراء بلاط أبيض 20 كغ',
          en: 'Col Pro White 20 KG',
        },
        price: 0,
        stock: 100,
        attributes: {
          color: 'White',
          weight: { value: 20, unit: 'kg' },
          type: 'Col Pro',
        },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009308',
        label: {
          ar: 'كول برو غراء بلاط أبيض 50 كغ',
          en: 'Col Pro White 50 KG',
        },
        price: 0,
        stock: 100,
        attributes: {
          color: 'White',
          weight: { value: 50, unit: 'kg' },
          type: 'Col Pro',
        },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009315',
        label: {
          ar: 'كول بريميوم غراء بلاط أبيض 20 كغ',
          en: 'Col Premium White 20 KG',
        },
        price: 0,
        stock: 100,
        attributes: {
          color: 'White',
          weight: { value: 20, unit: 'kg' },
          type: 'Col Premium',
        },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009316',
        label: {
          ar: 'كول بريميوم غراء بلاط أبيض 50 كغ',
          en: 'Col Premium White 50 KG',
        },
        price: 0,
        stock: 100,
        attributes: {
          color: 'White',
          weight: { value: 50, unit: 'kg' },
          type: 'Col Premium',
        },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009313',
        label: {
          ar: 'كول بريميوم غراء بلاط رمادي 20 كغ',
          en: 'Col Premium Gray 20 KG',
        },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Grey',
          weight: { value: 20, unit: 'kg' },
          type: 'Col Premium Gray',
        },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009314',
        label: {
          ar: 'كول بريميوم غراء بلاط رمادي 50 كغ',
          en: 'Col Premium Gray 50 KG',
        },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Grey',
          weight: { value: 50, unit: 'kg' },
          type: 'Col Premium Gray',
        },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009295',
        label: {
          ar: 'كول فلور مونة لاصقة رمادي 50 كغ',
          en: 'Col Floor Gray 50 KG',
        },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Grey',
          weight: { value: 50, unit: 'kg' },
          type: 'Col Floor Gray',
        },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
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
    subCategorySlug: 'repair-mortars-grouts',
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
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.BAG,
        },
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
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.BAG,
        },
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
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
        },
      },
      {
        sku: '2023009151',
        label: { ar: 'ريب بي سي تعشيش ناعم 20 كغ', en: 'Rep PC Fine 20 KG' },
        price: 58,
        stock: 120,
        attributes: { type: 'Fine PC', weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
        },
      },
      {
        sku: '2023009152',
        label: { ar: 'اس تي سي تعشيش خشن 20 كغ', en: 'ST Coarse 20 KG' },
        price: 52,
        stock: 120,
        attributes: { type: 'Coarse ST', weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
        },
      },
    ],
  },
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
    subCategorySlug: 'road-marking-paints',
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
        shippingProfile: {
          weightGrams: 4500,
          packageType: PackageType.GALLON,
        },
      },
      {
        sku: '2023009239',
        label: { ar: 'دهان طرق أسود 18 لتر', en: 'Road Mark Black 18 L' },
        price: 290,
        stock: 40,
        attributes: { color: 'Black', volume: { value: 18, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 23000,
          packageType: PackageType.DRUM,
        },
      },
      {
        sku: '2023009240',
        label: { ar: 'دهان طرق أبيض 3.6 لتر', en: 'Road Mark White 3.6 L' },
        price: 80,
        stock: 80,
        attributes: { color: 'White', volume: { value: 3.6, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 4500,
          packageType: PackageType.GALLON,
        },
      },
      {
        sku: '2023009238',
        label: { ar: 'دهان طرق أبيض 18 لتر', en: 'Road Mark White 18 L' },
        price: 310,
        stock: 40,
        attributes: { color: 'White', volume: { value: 18, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 23000,
          packageType: PackageType.DRUM,
        },
      },
      {
        sku: '2023009235',
        label: { ar: 'دهان طرق أصفر 3.6 لتر', en: 'Road Mark Yellow 3.6 L' },
        price: 85,
        stock: 80,
        attributes: { color: 'Yellow', volume: { value: 3.6, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 4500,
          packageType: PackageType.GALLON,
        },
      },
      {
        sku: '2023009236',
        label: { ar: 'دهان طرق أصفر 18 لتر', en: 'Road Mark Yellow 18 L' },
        price: 325,
        stock: 40,
        attributes: { color: 'Yellow', volume: { value: 18, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 23000,
          packageType: PackageType.DRUM,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر جوينت بروتكت 5 كغ',
      en: 'Sodamco Weber Joint Protect 5 KG',
    },
    slug: 'weber-joint-protect-5kg',
    description: {
      ar: 'ترويبة إسمنتية طاردة للماء ومضادة للعفن للفواصل حتى 6 مم، متوفرة بكامل مجموعة ألوان ويبر.',
      en: 'Water-repellent cementitious tile grout with anti-mold protection for joints up to 6 mm, available across the full Weber colour range.',
    },
    subCategorySlug: 'tile-adhesives-grouts',
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
        sku: '202300937',
        label: { ar: 'أبيض ياسمين 110', en: 'White Jasmine 110' },
        price: 0,
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
        sku: '202300969',
        label: { ar: 'عاجي 120', en: 'Ivory 120' },
        price: 0,
        stock: 100,
        attributes: { color: 'Ivory 120', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300940',
        label: { ar: 'بيج 121', en: 'Beige 121' },
        price: 0,
        stock: 100,
        attributes: { color: 'Beige 121', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009168',
        label: { ar: 'طيني 122', en: 'Clay 122' },
        price: 0,
        stock: 100,
        attributes: { color: 'Clay 122', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009188',
        label: { ar: 'كابتشينو 123', en: 'Cappuccino 123' },
        price: 0,
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
        sku: '2023009256',
        label: { ar: 'تيراكوتا 124', en: 'Terractta 124' },
        price: 0,
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
        sku: '2023009287',
        label: { ar: 'كستنائي 125', en: 'Chestnut 125' },
        price: 0,
        stock: 100,
        attributes: { color: 'Chestnut 125', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009288',
        label: { ar: 'شوكلاتة 126', en: 'Chocolate 126' },
        price: 0,
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
        sku: '2023009289',
        label: { ar: 'أصفر باستيل 130', en: 'Yellow Pastel 130' },
        price: 0,
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
        sku: '2023009290',
        label: { ar: 'بابونج 131', en: 'Chamomile 131' },
        price: 0,
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
        sku: '2023009291',
        label: { ar: 'خردل 132', en: 'Mustard 132' },
        price: 0,
        stock: 100,
        attributes: { color: 'Mustard 132', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009254',
        label: { ar: 'وردي فاتح 140', en: 'Pink Baby 140' },
        price: 0,
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
        sku: '2023009255',
        label: { ar: 'وردي عتيق 141', en: 'Pink Antique 141' },
        price: 0,
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
        sku: '2023009257',
        label: { ar: 'كرزي 142', en: 'Cherry 142' },
        price: 0,
        stock: 100,
        attributes: { color: 'Cherry 142', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009258',
        label: { ar: 'نعناع طازج 150', en: 'Mint Fresh 150' },
        price: 0,
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
        sku: '2023009259',
        label: { ar: 'ورقة الربيع 151', en: 'Leaf Spring 151' },
        price: 0,
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
        sku: '2023009260',
        label: { ar: 'أزرق سماوي فاتح 160', en: 'Blue Baby 160' },
        price: 0,
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
        sku: '202300939',
        label: { ar: 'أزرق سماوي 161', en: 'Blue Sky 161' },
        price: 0,
        stock: 100,
        attributes: { color: 'Blue Sky 161', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009104',
        label: { ar: 'رمادي فاتح 170', en: 'Gray Light 170' },
        price: 0,
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
        sku: '202300938',
        label: { ar: 'بلاتيني رمادي 171', en: 'Grey Platinium 171' },
        price: 0,
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
        sku: '202300976',
        label: { ar: 'رمادي غامق 172', en: 'Gray Ash 172' },
        price: 0,
        stock: 100,
        attributes: { color: 'Gray Ash 172', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009292',
        label: { ar: 'فحمي 173', en: 'Charcoal 173' },
        price: 0,
        stock: 100,
        attributes: { color: 'Charcoal 173', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300975',
        label: { ar: 'أسود 180', en: 'Black 180' },
        price: 0,
        stock: 100,
        attributes: { color: 'Black 180', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009293',
        label: { ar: 'صخري 227', en: 'Rock Desert 227' },
        price: 0,
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
        sku: '202300977',
        label: { ar: 'بني 228', en: 'Brown 228' },
        price: 0,
        stock: 100,
        attributes: { color: 'Brown 228', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009294',
        label: { ar: 'صحراوي 233', en: 'Sahara 233' },
        price: 0,
        stock: 100,
        attributes: { color: 'Sahara 233', weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009136',
        label: { ar: 'رمادي حريري 274', en: 'Grey Silk 274' },
        price: 0,
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
        sku: '2023009134',
        label: { ar: 'رمادي حجري 275', en: 'Grey Pebble 275' },
        price: 0,
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
  {
    title: {
      ar: 'سودامكو ويبر جوينت ثين 10 كغ',
      en: 'Sodamco Weber Joint Thin 10 KG',
    },
    slug: 'weber-joint-thin-10kg',
    description: {
      ar: 'ترويبة إسمنتية ناعمة للفواصل الضيقة حتى 3 مم بملمس ناعم، متوفرة بكامل مجموعة ألوان ويبر.',
      en: 'Fine cementitious grout for narrow tile joints up to 3 mm, smooth finish, available across the full Weber colour range.',
    },
    subCategorySlug: 'tile-adhesives-grouts',
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
        allowedValues: ['10'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300935',
        label: { ar: 'أبيض ياسمين 110', en: 'White Jasmine 110' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'White Jasmine 110',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009101',
        label: { ar: 'عاجي 120', en: 'Ivory 120' },
        price: 0,
        stock: 100,
        attributes: { color: 'Ivory 120', weight: { value: 10, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300934',
        label: { ar: 'بيج 121', en: 'Beige 121' },
        price: 0,
        stock: 100,
        attributes: { color: 'Beige 121', weight: { value: 10, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009153',
        label: { ar: 'طيني 122', en: 'Clay 122' },
        price: 0,
        stock: 100,
        attributes: { color: 'Clay 122', weight: { value: 10, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009154',
        label: { ar: 'كابتشينو 123', en: 'Cappuccino 123' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Cappuccino 123',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009155',
        label: { ar: 'تيراكوتا 124', en: 'Terractta 124' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Terractta 124',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009156',
        label: { ar: 'كستنائي 125', en: 'Chestnut 125' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Chestnut 125',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300918',
        label: { ar: 'شوكلاتة 126', en: 'Chocolate 126' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Chocolate 126',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009157',
        label: { ar: 'أصفر باستيل 130', en: 'Yellow Pastel 130' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Yellow Pastel 130',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009158',
        label: { ar: 'بابونج 131', en: 'Chamomile 131' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Chamomile 131',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009160',
        label: { ar: 'خردل 132', en: 'Mustard 132' },
        price: 0,
        stock: 100,
        attributes: { color: 'Mustard 132', weight: { value: 10, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009163',
        label: { ar: 'وردي فاتح 140', en: 'Pink Baby 140' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Pink Baby 140',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009164',
        label: { ar: 'وردي عتيق 141', en: 'Pink Antique 141' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Pink Antique 141',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009165',
        label: { ar: 'كرزي 142', en: 'Cherry 142' },
        price: 0,
        stock: 100,
        attributes: { color: 'Cherry 142', weight: { value: 10, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009161',
        label: { ar: 'نعناع طازج 150', en: 'Mint Fresh 150' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Mint Fresh 150',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009162',
        label: { ar: 'ورقة الربيع 151', en: 'Leaf Spring 151' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Leaf Spring 151',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009166',
        label: { ar: 'أزرق سماوي فاتح 160', en: 'Blue Baby 160' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Blue Baby 160',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300978',
        label: { ar: 'أزرق سماوي 161', en: 'Blue Sky 161' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Blue Sky 161',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300998',
        label: { ar: 'رمادي فاتح 170', en: 'Gray Light 170' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Gray Light 170',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300936',
        label: { ar: 'بلاتيني رمادي 171', en: 'Grey Platinium 171' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Grey Platinium 171',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300999',
        label: { ar: 'رمادي غامق 172', en: 'Gray Ash 172' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Gray Ash 172',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300970',
        label: { ar: 'فحمي 173', en: 'Charcoal 173' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Charcoal 173',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300979',
        label: { ar: 'أسود 180', en: 'Black 180' },
        price: 0,
        stock: 100,
        attributes: { color: 'Black 180', weight: { value: 10, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009286',
        label: { ar: 'صخري 227', en: 'Rock Desert 227' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Rock Desert 227',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300980',
        label: { ar: 'بني 228', en: 'Brown 228' },
        price: 0,
        stock: 100,
        attributes: { color: 'Brown 228', weight: { value: 10, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009159',
        label: { ar: 'صحراوي 233', en: 'Sahara 233' },
        price: 0,
        stock: 100,
        attributes: { color: 'Sahara 233', weight: { value: 10, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300926',
        label: { ar: 'رمادي حريري 274', en: 'Grey Silk 274' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Grey Silk 274',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009102',
        label: { ar: 'رمادي حجري 275', en: 'Grey Pebble 275' },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Grey Pebble 275',
          weight: { value: 10, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 10000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر كوت بيتون مضاد الكربنة 20 كغ',
      en: 'Sodamco Weber Cote Beton Anti-Carbonation 20 KG',
    },
    slug: 'weber-cote-beton',
    description: {
      ar: 'دهان حماية مطاطي مضاد لكربنة الخرسانة للواجهات والمنشآت الخرسانية، برميل 20 كغ.',
      en: 'Elastomeric anti-carbonation protective coating for concrete facades and structures, 20 KG drum.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      {
        name: 'type',
        type: 'string',
        allowedValues: ['164', '165', '166', '200', '506', '656'],
      },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009129',
        label: { ar: 'كوت بيتون 164 - 20 كغ', en: 'Cote Beton 164 - 20 KG' },
        price: 0,
        stock: 100,
        attributes: { type: '164', weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009127',
        label: { ar: 'كوت بيتون 165 - 20 كغ', en: 'Cote Beton 165 - 20 KG' },
        price: 0,
        stock: 100,
        attributes: { type: '165', weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009128',
        label: { ar: 'كوت بيتون 166 - 20 كغ', en: 'Cote Beton 166 - 20 KG' },
        price: 0,
        stock: 100,
        attributes: { type: '166', weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009124',
        label: { ar: 'كوت بيتون 200 - 20 كغ', en: 'Cote Beton 200 - 20 KG' },
        price: 0,
        stock: 100,
        attributes: { type: '200', weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009125',
        label: { ar: 'كوت بيتون 506 - 20 كغ', en: 'Cote Beton 506 - 20 KG' },
        price: 0,
        stock: 100,
        attributes: { type: '506', weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009126',
        label: { ar: 'كوت بيتون 656 - 20 كغ', en: 'Cote Beton 656 - 20 KG' },
        price: 0,
        stock: 100,
        attributes: { type: '656', weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر سكيم كوت معجون تشطيب',
      en: 'Sodamco Weber Skim Coat Finishing Putty',
    },
    slug: 'weber-skim-coat',
    description: {
      ar: 'معجون إسمنتي للتشطيب الناعم للجدران الداخلية والخارجية، أبيض أو رمادي.',
      en: 'Cementitious skim coat for smooth interior and exterior wall finishing, white or grey.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['White', 'Gray'] },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['25', '50'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009263',
        label: { ar: 'سكيم كوت أبيض 25 كغ', en: 'Skim Coat White 25 KG' },
        price: 0,
        stock: 100,
        attributes: { color: 'White', weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009264',
        label: { ar: 'سكيم كوت أبيض 50 كغ', en: 'Skim Coat White 50 KG' },
        price: 0,
        stock: 100,
        attributes: { color: 'White', weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009265',
        label: { ar: 'سكيم كوت رمادي 25 كغ', en: 'Skim Coat Gray 25 KG' },
        price: 0,
        stock: 100,
        attributes: { color: 'Gray', weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009266',
        label: { ar: 'سكيم كوت رمادي 50 كغ', en: 'Skim Coat Gray 50 KG' },
        price: 0,
        stock: 100,
        attributes: { color: 'Gray', weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر بريمكس فاين فينيش معجون ناعم مقاوم',
      en: 'Sodamco Weber Premix Fine Finish',
    },
    slug: 'weber-premix-fine-finish',
    description: {
      ar: 'معجون ناعم جاهز مقاوم للعوامل الجوية للجدران الداخلية والخارجية، أبيض.',
      en: 'Ready-mixed weather-resistant fine white finishing putty for interior and exterior walls.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['25', '50'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300955',
        label: {
          ar: 'بريمكس فاين فينيش 25 كغ',
          en: 'Premix Fine Finish 25 KG',
        },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300917',
        label: {
          ar: 'بريمكس فاين فينيش 50 كغ',
          en: 'Premix Fine Finish 50 KG',
        },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر بريمكس فاين كوت معجون إسمنتي ناعم 25 كغ',
      en: 'Sodamco Weber Premix Fine Coat 25 KG',
    },
    slug: 'weber-premix-fine-coat',
    description: {
      ar: 'معجون إسمنتي ناعم أبيض لتسوية الأسطح الملّيسة قبل الدهان.',
      en: 'Cementitious fine white skim coat for levelling plastered surfaces before painting.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['25'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300956',
        label: { ar: 'بريمكس فاين كوت 25 كغ', en: 'Premix Fine Coat 25 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر بريمكس بوتي معجون جدران أبيض 20 كغ',
      en: 'Sodamco Weber Premix Putty White 20 KG',
    },
    slug: 'weber-premix-putty',
    description: {
      ar: 'معجون جدران أبيض جاهز للاستعمال لتنعيم الأسطح الداخلية، برميل 20 كغ.',
      en: 'Ready-to-use white wall putty for smoothing interior surfaces, 20 KG pail.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['White'] },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009262',
        label: { ar: 'بريمكس بوتي أبيض 20 كغ', en: 'Premix Putty White 20 KG' },
        price: 0,
        stock: 100,
        attributes: { color: 'White', weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر بريمكس اس بي 11 لياسة جاهزة 50 كغ',
      en: 'Sodamco Weber Premix 11 SP 50 KG',
    },
    slug: 'weber-premix-11-sp',
    description: {
      ar: 'لياسة إسمنتية جاهزة للجدران الداخلية والخارجية، كيس 50 كغ.',
      en: 'Ready-mixed cementitious rendering plaster for internal and external masonry, 50 KG bag.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['50'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300954',
        label: { ar: 'بريمكس اس بي 11 - 50 كغ', en: 'Premix 11 SP 50 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر بريمكس 2 اس ار سي طرطشة جاهزة 50 كغ',
      en: 'Sodamco Weber Premix 2 SRC 50 KG',
    },
    slug: 'weber-premix-2-src',
    description: {
      ar: 'طرطشة جاهزة مقاومة للأملاح كطبقة ربط للأسطح قبل اللياسة، كيس 50 كغ.',
      en: 'Ready-mixed sulphate-resisting spatterdash key coat for masonry substrates, 50 KG bag.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['50'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300962',
        label: { ar: 'بريمكس 2 اس ار سي - 50 كغ', en: 'Premix 2 SRC 50 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر بلوك فيكس غراء بلوك 50 كغ',
      en: 'Sodamco Weber Bloc Fix Block Adhesive 50 KG',
    },
    slug: 'weber-bloc-fix',
    description: {
      ar: 'مونة لاصقة إسمنتية رقيقة الطبقة لبناء البلوك الخفيف والمعالج بالبخار.',
      en: 'Thin-bed cementitious adhesive mortar for laying lightweight and autoclaved aerated blocks.',
    },
    subCategorySlug: 'tile-adhesives-grouts',
    allowedAttributes: [
      {
        name: 'type',
        type: 'string',
        allowedValues: ['LW White', 'LW Gray', 'A S', 'A M', 'A N'],
      },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['50'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300973',
        label: {
          ar: 'بلوك فيكس ال دبليو أبيض 50 كغ',
          en: 'Bloc Fix LW White 50 KG',
        },
        price: 0,
        stock: 100,
        attributes: { type: 'LW White', weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300968',
        label: {
          ar: 'بلوك فيكس ال دبليو رمادي 50 كغ',
          en: 'Bloc Fix LW Gray 50 KG',
        },
        price: 0,
        stock: 100,
        attributes: { type: 'LW Gray', weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009110',
        label: { ar: 'بلوك فيكس اي اس 50 كغ', en: 'Bloc Fix A S 50 KG' },
        price: 0,
        stock: 100,
        attributes: { type: 'A S', weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009103',
        label: { ar: 'بلوك فيكس اي ام 50 كغ', en: 'Bloc Fix A M 50 KG' },
        price: 0,
        stock: 100,
        attributes: { type: 'A M', weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009108',
        label: { ar: 'بلوك فيكس اي ان 50 كغ', en: 'Bloc Fix A N 50 KG' },
        price: 0,
        stock: 100,
        attributes: { type: 'A N', weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر اد 205 بي في ايه بوند 20 لتر',
      en: 'Sodamco Weber Ad 205 PVA Bond 20 LTR',
    },
    slug: 'weber-ad-205-pva',
    description: {
      ar: 'مادة ربط أساسها البولي فينيل أسيتات ومثبّت أتربة للمونات واللياسات الإسمنتية.',
      en: 'PVA-based bonding agent and dust binder for cementitious mortars and plasters.',
    },
    subCategorySlug: 'concrete-admixtures',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009113',
        label: { ar: 'اد 205 بي في ايه 20 لتر', en: 'Ad 205 PVA 20 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر اد 22 ديم مانع التصاق قوالب',
      en: 'Sodamco Weber Ad 22 Dem Mould Release Agent',
    },
    slug: 'weber-ad-22-dem',
    description: {
      ar: 'مادة كيميائية تمنع التصاق الخرسانة بالقوالب والشدّات الخشبية والمعدنية.',
      en: 'Chemical mould release agent that prevents concrete from bonding to formwork.',
    },
    subCategorySlug: 'concrete-admixtures',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['20', '200'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '202300972',
        label: { ar: 'اد 22 ديم 20 لتر', en: 'Ad 22 Dem 20 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300981',
        label: { ar: 'اد 22 ديم 200 لتر', en: 'Ad 22 Dem 200 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 200, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 256000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر اد 220 اس بي ار 20 لتر',
      en: 'Sodamco Weber Ad 220 SBR 20 LTR',
    },
    slug: 'weber-ad-220-sbr',
    description: {
      ar: 'مادة ربط ومحسّن أساسها مطاط الستايرين بيوتادين للمونات وأعمال الترميم.',
      en: 'Styrene-butadiene rubber latex bonding and gauging admixture for repair mortars.',
    },
    subCategorySlug: 'concrete-admixtures',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009109',
        label: { ar: 'اد 220 اس بي ار 20 لتر', en: 'Ad 220 SBR 20 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر اد 225 ام بي 20 لتر',
      en: 'Sodamco Weber Ad 225 MB 20 LTR',
    },
    slug: 'weber-ad-225-mb',
    description: {
      ar: 'مادة ربط متعددة الاستعمالات للمونات والسكريد الإسمنتي.',
      en: 'Multi-purpose bonding admixture for cementitious mortars and screeds.',
    },
    subCategorySlug: 'concrete-admixtures',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '202300959',
        label: { ar: 'اد 225 ام بي 20 لتر', en: 'Ad 225 MB 20 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر اد 240 ال تي اكس 20 لتر',
      en: 'Sodamco Weber Ad 240 LTX 20 LTR',
    },
    slug: 'weber-ad-240-ltx',
    description: {
      ar: 'محسّن لاتكس يزيد من التصاق ومرونة ومقاومة المونة للماء.',
      en: 'Latex admixture improving adhesion, flexibility and water resistance of mortars.',
    },
    subCategorySlug: 'concrete-admixtures',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009112',
        label: { ar: 'اد 240 ال تي اكس 20 لتر', en: 'Ad 240 LTX 20 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر اد 244 ار بي اي',
      en: 'Sodamco Weber Ad 244 RBA Rebar Coating',
    },
    slug: 'weber-ad-244-rba',
    description: {
      ar: 'طلاء إسمنتي مانع للصدأ وجسر ربط لحديد التسليح المكشوف.',
      en: 'Cementitious anti-corrosion coating and bonding bridge for exposed reinforcement steel.',
    },
    subCategorySlug: 'concrete-admixtures',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['5', '20'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '202300921',
        label: { ar: 'اد 244 ار بي اي 5 لتر', en: 'Ad 244 RBA 5 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 5, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 6400,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300922',
        label: { ar: 'اد 244 ار بي اي 20 لتر', en: 'Ad 244 RBA 20 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر اد ساك بي 20 كغ',
      en: 'Sodamco Weber Ad Sec P 20 KG',
    },
    slug: 'weber-ad-sec-p',
    description: {
      ar: 'مادة عزل مائي مدمجة على شكل بودرة للخرسانة والمونات الإسمنتية.',
      en: 'Powder integral waterproofing admixture for concrete and cementitious mortars.',
    },
    subCategorySlug: 'concrete-admixtures',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300963',
        label: { ar: 'اد ساك بي 20 كغ', en: 'Ad Sec P 20 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر اد سيمتكس ام 3 كغ',
      en: 'Sodamco Weber Ad Cemtex M 3 KG',
    },
    slug: 'weber-ad-cemtex-m',
    description: {
      ar: 'مادة ملدّنة ومقلّلة للماء للمونات واللياسات الإسمنتية.',
      en: 'Plasticising and water-reducing admixture for cement mortars and renders.',
    },
    subCategorySlug: 'concrete-admixtures',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['3'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300974',
        label: { ar: 'اد سيمتكس ام 3 كغ', en: 'Ad Cemtex M 3 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 3, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 3000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر اد فايبر ام 600 جرام',
      en: 'Sodamco Weber Ad Fiber M 600 G',
    },
    slug: 'weber-ad-fiber-m',
    description: {
      ar: 'ألياف بولي بروبيلين دقيقة تحدّ من تشققات الانكماش اللدن في الخرسانة والسكريد.',
      en: 'Polypropylene micro-fibres that control plastic shrinkage cracking in concrete and screeds.',
    },
    subCategorySlug: 'concrete-admixtures',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['600'],
        allowedUnits: ['g'],
      },
    ],
    variants: [
      {
        sku: '202300994',
        label: { ar: 'اد فايبر ام 600 جرام', en: 'Ad Fiber M 600 G' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 600, unit: 'g' } },
        shippingProfile: {
          weightGrams: 600,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر اد كيور 20 واي مادة معالجة خرسانة',
      en: 'Sodamco Weber Ad Cure 20 Y Curing Compound',
    },
    slug: 'weber-ad-cure-20-y',
    description: {
      ar: 'مادة معالجة أساسها الشمع تحافظ على ماء الخلط في الخرسانة حديثة الصب.',
      en: 'Wax-based curing compound that retains mixing water in freshly placed concrete.',
    },
    subCategorySlug: 'concrete-admixtures',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['20', '200'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '202300923',
        label: { ar: 'اد كيور 20 واي 20 لتر', en: 'Ad Cure 20 Y 20 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300964',
        label: { ar: 'اد كيور 20 واي 200 لتر', en: 'Ad Cure 20 Y 200 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 200, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 256000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر انك 405 بي اف اكس تزريع حديد 400 مل',
      en: 'Sodamco Weber Anc 405 BFX 400 ML',
    },
    slug: 'weber-anc-405-bfx',
    description: {
      ar: 'خرطوشة تزريع كيميائي فينيل إستر خالية من الستايرين لتثبيت حديد التسليح والأسياخ.',
      en: 'Styrene-free vinylester chemical anchor cartridge for rebar and threaded rod fixing.',
    },
    subCategorySlug: 'chemical-anchors',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['400'],
        allowedUnits: ['ml'],
      },
    ],
    variants: [
      {
        sku: '202300913',
        label: { ar: 'انك 405 بي اف اكس 400 مل', en: 'Anc 405 BFX 400 ML' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 400, unit: 'ml' } },
        shippingProfile: {
          weightGrams: 568,
          packageType: PackageType.PIECE,
          quantityPerPackage: 12,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر انك 535 في اي تزريع حديد 300 مل',
      en: 'Sodamco Weber Anc 535 VE 300 ML',
    },
    slug: 'weber-anc-535-ve',
    description: {
      ar: 'خرطوشة راتنج فينيل إستر للتثبيت الكيميائي عالي التحمل في الخرسانة.',
      en: 'Vinylester chemical anchoring resin cartridge for high-load fixings in concrete.',
    },
    subCategorySlug: 'chemical-anchors',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['300'],
        allowedUnits: ['ml'],
      },
    ],
    variants: [
      {
        sku: '202300927',
        label: { ar: 'انك 535 في اي 300 مل', en: 'Anc 535 VE 300 ML' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 300, unit: 'ml' } },
        shippingProfile: {
          weightGrams: 426,
          packageType: PackageType.PIECE,
          quantityPerPackage: 12,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر جون 405 بي اف اكس مسدس تزريع حديد',
      en: 'Sodamco Weber GUN 405 BFX Anchor Applicator',
    },
    slug: 'weber-anc-gun-405-bfx',
    description: {
      ar: 'مسدس يدوي لضخ خراطيش التزريع الكيميائي ويبر انك 405 بي اف اكس.',
      en: 'Manual dispensing gun for Weber Anc 405 BFX chemical anchor cartridges.',
    },
    subCategorySlug: 'chemical-anchors',
    allowedAttributes: [
      { name: 'type', type: 'string', allowedValues: ['405 BFX'] },
    ],
    variants: [
      {
        sku: '202300910',
        label: { ar: 'جون 405 بي اف اكس', en: 'GUN 405 BFX' },
        price: 0,
        stock: 100,
        attributes: { type: '405 BFX' },
        shippingProfile: {
          weightGrams: 900,
          packageType: PackageType.PIECE,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر بي بلاس ممبرين بيتوميني 4 مم',
      en: 'Sodamco Weber Biplas APP Bituminous Membrane 4 MM',
    },
    slug: 'weber-biplas-membrane',
    description: {
      ar: 'لفائف عزل مائي بيتومينية معدّلة بـ APP تُلصق بالحرارة، سماكة 4 مم، بتسليح بوليستر أو ألياف زجاجية.',
      en: 'APP modified bituminous waterproofing membrane, torch applied, 4 mm thick, polyester or glass fibre reinforced.',
    },
    subCategorySlug: 'bituminous-membranes',
    allowedAttributes: [
      {
        name: 'type',
        type: 'string',
        allowedValues: ['SL 180', 'SL 200', 'PL 160', 'PL 180', 'PL 200'],
      },
      {
        name: 'thickness',
        type: 'number',
        allowedValues: ['4'],
        allowedUnits: ['mm'],
      },
    ],
    variants: [
      {
        sku: '2023009117',
        label: {
          ar: 'بي بلاس اس ال 180 جرام 4 مم',
          en: 'Biplas SL 180 Gsm 4 MM',
        },
        price: 0,
        stock: 100,
        attributes: { type: 'SL 180', thickness: { value: 4, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 42000,
          packageType: PackageType.ROLL,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009118',
        label: {
          ar: 'بي بلاس اس ال 200 جرام 4 مم',
          en: 'Biplas SL 200 Gsm 4 MM',
        },
        price: 0,
        stock: 100,
        attributes: { type: 'SL 200', thickness: { value: 4, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 42000,
          packageType: PackageType.ROLL,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300944',
        label: {
          ar: 'بي بلاس بي ال 160 جرام 4 مم',
          en: 'Biplas PL 160 Gsm 4 MM',
        },
        price: 0,
        stock: 100,
        attributes: { type: 'PL 160', thickness: { value: 4, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 42000,
          packageType: PackageType.ROLL,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300941',
        label: {
          ar: 'بي بلاس بي ال 180 جرام 4 مم',
          en: 'Biplas PL 180 Gsm 4 MM',
        },
        price: 0,
        stock: 100,
        attributes: { type: 'PL 180', thickness: { value: 4, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 42000,
          packageType: PackageType.ROLL,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009114',
        label: {
          ar: 'بي بلاس بي ال 200 جرام 4 مم',
          en: 'Biplas PL 200 Gsm 4 MM',
        },
        price: 0,
        stock: 100,
        attributes: { type: 'PL 200', thickness: { value: 4, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 42000,
          packageType: PackageType.ROLL,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر بي راب بي ال 160 جرام 4 مم',
      en: 'Sodamco Weber Birap PL 160 Gsm 4 MM',
    },
    slug: 'weber-birap-membrane',
    description: {
      ar: 'لفائف عزل مائي بيتومينية بتسليح بوليستر لعزل القواعد والأساسات، سماكة 4 مم.',
      en: 'Polyester reinforced bituminous membrane for foundation and substructure waterproofing, 4 mm.',
    },
    subCategorySlug: 'bituminous-membranes',
    allowedAttributes: [
      { name: 'type', type: 'string', allowedValues: ['PL 160'] },
      {
        name: 'thickness',
        type: 'number',
        allowedValues: ['4'],
        allowedUnits: ['mm'],
      },
    ],
    variants: [
      {
        sku: '202300948',
        label: {
          ar: 'بي راب بي ال 160 جرام 4 مم',
          en: 'Birap PL 160 Gsm 4 MM',
        },
        price: 0,
        stock: 100,
        attributes: { type: 'PL 160', thickness: { value: 4, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 42000,
          packageType: PackageType.ROLL,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر بي فليكس بي ال اي ممبرين 4 مم',
      en: 'Sodamco Weber Biflex PLE SBS Membrane 4 MM',
    },
    slug: 'weber-biflex-membrane',
    description: {
      ar: 'لفائف عزل مائي بيتومينية مرنة معدّلة بـ SBS عالية المرونة في الحرارة المنخفضة، سماكة 4 مم.',
      en: 'SBS elastomeric bituminous membrane with high flexibility at low temperature, 4 mm.',
    },
    subCategorySlug: 'bituminous-membranes',
    allowedAttributes: [
      { name: 'type', type: 'string', allowedValues: ['PLE 180', 'PLE 200'] },
      {
        name: 'thickness',
        type: 'number',
        allowedValues: ['4'],
        allowedUnits: ['mm'],
      },
    ],
    variants: [
      {
        sku: '2023009115',
        label: {
          ar: 'بي فليكس بي ال اي 180 جرام 4 مم',
          en: 'Biflex PLE 180 Gsm 4 MM',
        },
        price: 0,
        stock: 100,
        attributes: { type: 'PLE 180', thickness: { value: 4, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 42000,
          packageType: PackageType.ROLL,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009116',
        label: {
          ar: 'بي فليكس بي ال اي 200 جرام 4 مم',
          en: 'Biflex PLE 200 Gsm 4 MM',
        },
        price: 0,
        stock: 100,
        attributes: { type: 'PLE 200', thickness: { value: 4, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 42000,
          packageType: PackageType.ROLL,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي سوبر بلاك عازل أسود 20 كغ',
      en: 'Sodamco Weber Dry Super Black 20 KG',
    },
    slug: 'weber-dry-super-black',
    description: {
      ar: 'عازل مائي سائل بيتوميني مطاطي للأسطح والأجزاء المدفونة.',
      en: 'Bituminous rubberised liquid waterproofing coating for roofs and buried surfaces.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['Black'] },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300905',
        label: { ar: 'دراي سوبر بلاك 20 كغ', en: 'Dry Super Black 20 KG' },
        price: 0,
        stock: 100,
        attributes: { color: 'Black', weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي روف عازل أبيض 20 كغ',
      en: 'Sodamco Weber Dry Roof White 20 KG',
    },
    slug: 'weber-dry-roof-white',
    description: {
      ar: 'عازل أسطح أكريليكي مطاطي أبيض يعزل الماء ويعكس حرارة الشمس.',
      en: 'White elastomeric acrylic roof coating that waterproofs and reflects solar heat.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['White'] },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300906',
        label: { ar: 'دراي روف أبيض 20 كغ', en: 'Dry Roof White 20 KG' },
        price: 0,
        stock: 100,
        attributes: { color: 'White', weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي جوم 25 كغ',
      en: 'Sodamco Weber Dry Gum 25 KG',
    },
    slug: 'weber-dry-gum',
    description: {
      ar: 'مستحلب بيتوميني مطاطي لعزل الرطوبة وحماية الأسطح الخرسانية.',
      en: 'Rubberised bituminous emulsion for damp proofing and protective coating of concrete.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['25'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009142',
        label: { ar: 'دراي جوم 25 كغ', en: 'Dry Gum 25 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي بيتوم اس بي كي عزل قواعد',
      en: 'Sodamco Weber Dry Bitum SB K Solvent Based',
    },
    slug: 'weber-dry-bitum-sb-k',
    description: {
      ar: 'دهان بيتوميني أساسه مذيب لعزل القواعد والخرسانة المدفونة.',
      en: 'Solvent based bituminous coating for waterproofing foundations and buried concrete.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['18', '200'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009139',
        label: {
          ar: 'دراي بيتوم اس بي كي 18 لتر',
          en: 'Dry Bitum SB K 18 LTR',
        },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 18, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 23000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009140',
        label: {
          ar: 'دراي بيتوم اس بي كي 200 لتر',
          en: 'Dry Bitum SB K 200 LTR',
        },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 200, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 256000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي بيتوم دبليو بي كي عزل قواعد',
      en: 'Sodamco Weber Dry Bitum WB K Water Based',
    },
    slug: 'weber-dry-bitum-wb-k',
    description: {
      ar: 'مستحلب بيتوميني أساسه الماء لعزل رطوبة القواعد والأساسات.',
      en: 'Water based bituminous emulsion for damp proofing foundations and substructures.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['kg'],
      },
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['200'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '202300928',
        label: {
          ar: 'دراي بيتوم دبليو بي كي 20 كغ',
          en: 'Dry Bitum WB K 20 KG',
        },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300967',
        label: {
          ar: 'دراي بيتوم دبليو بي كي 200 لتر',
          en: 'Dry Bitum WB K 200 LTR',
        },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 200, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 256000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي تار اي اس بي إيبوكسي تار أسود 20 لتر',
      en: 'Sodamco Weber Dry Tar ESB Black 20 LTR',
    },
    slug: 'weber-dry-tar-esb',
    description: {
      ar: 'دهان حماية إيبوكسي تار للخرسانة المدفونة والحديد وخزانات المياه.',
      en: 'Epoxy tar protective coating for buried concrete, steel and water retaining structures.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['Black'] },
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009305',
        label: {
          ar: 'دراي تار اي اس بي أسود 20 لتر',
          en: 'Dry Tar ESB Black 20 LTR',
        },
        price: 0,
        stock: 100,
        attributes: { color: 'Black', volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي 360 بي يو عازل بولي يوريثان 25 كغ',
      en: 'Sodamco Weber Dry 360 PU Liquid Membrane 25 KG',
    },
    slug: 'weber-dry-360-pu',
    description: {
      ar: 'عازل مائي سائل أحادي المكوّن من البولي يوريثان للأسطح المكشوفة.',
      en: 'One component polyurethane liquid applied waterproofing membrane for exposed roofs.',
    },
    subCategorySlug: 'polyurethane-polyurea',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['White', 'Black'] },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['25'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300915',
        label: {
          ar: 'دراي 360 بي يو أبيض 25 كغ',
          en: 'Dry 360 PU White 25 KG',
        },
        price: 0,
        stock: 100,
        attributes: { color: 'White', weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300914',
        label: {
          ar: 'دراي 360 بي يو أسود 25 كغ',
          en: 'Dry 360 PU Black 25 KG',
        },
        price: 0,
        stock: 100,
        attributes: { color: 'Black', weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي بي ال سي 150 بلج',
      en: 'Sodamco Weber Dry BLC 150 Plug',
    },
    slug: 'weber-dry-blc-150-plug',
    description: {
      ar: 'إسمنت سريع الشك يوقف تسربات المياه النشطة في الخرسانة فوراً.',
      en: 'Rapid setting hydraulic cement that instantly plugs active water leaks in concrete.',
    },
    subCategorySlug: 'cementitious-waterproofing',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['5', '20'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300908',
        label: {
          ar: 'دراي بي ال سي 150 بلج 5 كغ',
          en: 'Dry BLC 150 Plug 5 KG',
        },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300907',
        label: {
          ar: 'دراي بي ال سي 150 بلج 20 كغ',
          en: 'Dry BLC 150 Plug 20 KG',
        },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي 610 اي إنجكشن حقن خرسانة',
      en: 'Sodamco Weber Dry 610 I Concrete Injection',
    },
    slug: 'weber-dry-610-injection',
    description: {
      ar: 'راتنج حقن ثنائي المكوّن لسد الشقوق ومنع تسرب المياه في الخرسانة.',
      en: 'Two component injection resin for sealing cracks and stopping water ingress in concrete.',
    },
    subCategorySlug: 'injection-waterstop',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['10.92', '27.3'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009137',
        label: { ar: 'دراي 610 اي 10.92 كغ', en: 'Dry 610 I 10.92 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 10.92, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 10920,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009138',
        label: { ar: 'دراي 610 اي 27.30 كغ', en: 'Dry 610 I 27.30 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 27.3, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 27300,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي 630 اي إنجكشن حقن خرسانة 5 كغ',
      en: 'Sodamco Weber Dry 630 I 5 KG',
    },
    slug: 'weber-dry-630-injection',
    description: {
      ar: 'راتنج حقن لسد الشقوق الدقيقة وفواصل الصب في المنشآت الخرسانية.',
      en: 'Injection resin for sealing fine cracks and construction joints in concrete structures.',
    },
    subCategorySlug: 'injection-waterstop',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['5'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009312',
        label: { ar: 'دراي 630 اي 5 كغ', en: 'Dry 630 I 5 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 5000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي ايبو دبليو بي إيبوكسي خزانات مياه',
      en: 'Sodamco Weber Dry Epo PW Potable Water Tank Epoxy',
    },
    slug: 'weber-dry-epo-pw',
    description: {
      ar: 'بطانة إيبوكسي ثنائية المكوّن خالية من المذيبات معتمدة لخزانات مياه الشرب.',
      en: 'Two component solvent free epoxy lining certified for potable water storage tanks.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['Blue', 'Gray'] },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['15', '20'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009100',
        label: {
          ar: 'دراي ايبو دبليو بي أزرق 15 كغ',
          en: 'Dry Epo PW Blue 15 KG',
        },
        price: 0,
        stock: 100,
        attributes: { color: 'Blue', weight: { value: 15, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 15000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009141',
        label: {
          ar: 'دراي ايبو دبليو بي رمادي 20 كغ',
          en: 'Dry Epo PW Gray 20 KG',
        },
        price: 0,
        stock: 100,
        attributes: { color: 'Gray', weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي 132 دبليو بي عازل حجر',
      en: 'Sodamco Weber Dry 132 WB Stone Protector',
    },
    slug: 'weber-dry-132-wb',
    description: {
      ar: 'مادة تشرّب سيليكونية أساسها الماء تمنع امتصاص الماء في واجهات الحجر والبناء.',
      en: 'Water based silicone impregnation that repels water from stone and masonry facades.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['5', '20', '200'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '202300965',
        label: { ar: 'دراي 132 دبليو بي 5 لتر', en: 'Dry 132 WB 5 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 5, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 6400,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300930',
        label: { ar: 'دراي 132 دبليو بي 20 لتر', en: 'Dry 132 WB 20 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300966',
        label: { ar: 'دراي 132 دبليو بي 200 لتر', en: 'Dry 132 WB 200 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 200, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 256000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي 135 دبليو ار عازل حجر 20 لتر',
      en: 'Sodamco Weber Dry 135 WR 20 LTR',
    },
    slug: 'weber-dry-135-wr',
    description: {
      ar: 'مادة صادّة للماء لتشريب الحجر الطبيعي والخرسانة والواجهات الإسمنتية.',
      en: 'Water repellent impregnation for natural stone, concrete and cementitious facades.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009304',
        label: { ar: 'دراي 135 دبليو ار 20 لتر', en: 'Dry 135 WR 20 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر ستون بروف عازل حجر',
      en: 'Sodamco Weber Stone Proof Stone Sealer',
    },
    slug: 'weber-stone-proof',
    description: {
      ar: 'عازل نافذ يحمي تكسيات الحجر من الماء والأملاح والبقع.',
      en: 'Penetrating sealer that protects stone cladding from water, salts and staining.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['5', '20'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009310',
        label: { ar: 'ستون بروف 5 لتر', en: 'Stone Proof 5 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 5, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 6400,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009311',
        label: { ar: 'ستون بروف 20 لتر', en: 'Stone Proof 20 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي كريستال عازل إسمنتي بلوري 25 كغ',
      en: 'Sodamco Weber Dry Crystal 25 KG',
    },
    slug: 'weber-dry-crystal',
    description: {
      ar: 'عازل إسمنتي بلوري يسد المسام الشعرية داخل الخرسانة ويمنع نفاذ الماء.',
      en: 'Crystalline cementitious waterproofing that seals concrete capillaries from within.',
    },
    subCategorySlug: 'cementitious-waterproofing',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['25'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300958',
        label: { ar: 'دراي كريستال 25 كغ', en: 'Dry Crystal 25 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي سويل بار ار بي 20*10 مم 25 متر',
      en: 'Sodamco Weber Dry Swellbar RB 20x10 MM 25 M',
    },
    slug: 'weber-dry-swellbar-rb',
    description: {
      ar: 'شريط وتر ستوب منتفخ يتمدد عند ملامسة الماء لسد فواصل الصب.',
      en: 'Hydrophilic swelling waterstop bar that expands on contact with water to seal construction joints.',
    },
    subCategorySlug: 'injection-waterstop',
    allowedAttributes: [
      {
        name: 'length',
        type: 'number',
        allowedValues: ['25'],
        allowedUnits: ['m'],
      },
      {
        name: 'thickness',
        type: 'number',
        allowedValues: ['10'],
        allowedUnits: ['mm'],
      },
    ],
    variants: [
      {
        sku: '2023009148',
        label: {
          ar: 'دراي سويل بار ار بي 20*10 مم 25 متر',
          en: 'Dry Swellbar RB 20x10 MM 25 M',
        },
        price: 0,
        stock: 100,
        attributes: {
          length: { value: 25, unit: 'm' },
          thickness: { value: 10, unit: 'mm' },
        },
        shippingProfile: {
          weightGrams: 9000,
          packageType: PackageType.ROLL,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي اس بي اف 45 فوم بولي يوريثان 460 كغ',
      en: 'Sodamco Weber Dry SPF 45 Spray Polyurethane Foam 460 KG',
    },
    slug: 'weber-dry-spf-45',
    description: {
      ar: 'نظام فوم بولي يوريثان ثنائي المكوّن يُرش للعزل الحراري والمائي.',
      en: 'Two component spray applied polyurethane foam system for thermal insulation and waterproofing.',
    },
    subCategorySlug: 'polyurethane-polyurea',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['460'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009147',
        label: { ar: 'دراي اس بي اف 45 - 460 كغ', en: 'Dry SPF 45 460 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 460, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 460000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي برايم اس بي برايمر بيتوميني',
      en: 'Sodamco Weber Dry Prime SB Bituminous Primer',
    },
    slug: 'weber-dry-prime-sb',
    description: {
      ar: 'برايمر بيتوميني أساسه مذيب لتحضير الأسطح قبل تركيب لفائف العزل.',
      en: 'Solvent based bituminous primer that prepares substrates before membrane application.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['18', '200'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009145',
        label: { ar: 'دراي برايم اس بي 18 لتر', en: 'Dry Prime SB 18 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 18, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 23000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009146',
        label: { ar: 'دراي برايم اس بي 200 لتر', en: 'Dry Prime SB 200 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 200, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 256000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر دراي جي برايمر جبس بورد',
      en: 'Sodamco Weber Dry Prime G Gypsum Board Primer',
    },
    slug: 'weber-dry-prime-g',
    description: {
      ar: 'برايمر أكريليكي يغلق مسام ألواح الجبس واللياسة قبل التبليط أو العزل.',
      en: 'Acrylic primer that seals gypsum board and plaster before tiling or waterproofing.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['5', '20'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009143',
        label: { ar: 'دراي جي برايمر 5 لتر', en: 'Dry Prime G 5 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 5, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 6400,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009144',
        label: { ar: 'دراي جي برايمر 20 لتر', en: 'Dry Prime G 20 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر كول برايم 20 لتر',
      en: 'Sodamco Weber Col Prime 20 LTR',
    },
    slug: 'weber-col-prime',
    description: {
      ar: 'برايمر أكريليكي يحسّن التصاق غراء البلاط على الأسطح الملساء أو الماصّة.',
      en: 'Acrylic bonding primer that improves tile adhesive grip on smooth or absorbent substrates.',
    },
    subCategorySlug: 'tile-adhesives-grouts',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['20'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009123',
        label: { ar: 'كول برايم 20 لتر', en: 'Col Prime 20 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر كول ايبو بلس غراء بلاط إيبوكسي 18 كغ',
      en: 'Sodamco Weber Col Epo Plus Epoxy Tile Adhesive 18 KG',
    },
    slug: 'weber-col-epo-plus',
    description: {
      ar: 'غراء وترويبة إيبوكسي ثلاثية المكوّنات للبلاط المعرّض للمواد الكيميائية والاستخدام الشاق.',
      en: 'Three component epoxy adhesive and grout for tiles exposed to chemicals and heavy duty service.',
    },
    subCategorySlug: 'tile-adhesives-grouts',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['18'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009119',
        label: { ar: 'كول ايبو بلس 18 كغ', en: 'Col Epo Plus 18 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 18, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 18000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر فلور ايبو بارك إيبوكسي سيلف ليفل 27.5 كغ',
      en: 'Sodamco Weber Floor Epo Park 27.5 KG',
    },
    slug: 'weber-floor-epo-park',
    description: {
      ar: 'نظام أرضيات إيبوكسي ذاتي التسوية ثلاثي المكوّنات للمواقف والمناطق كثيفة الحركة.',
      en: 'Three component self levelling epoxy flooring system for car parks and heavy traffic areas.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['27.5'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009230',
        label: { ar: 'فلور ايبو بارك 27.5 كغ', en: 'Floor Epo Park 27.5 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 27.5, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 27500,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر فلور ايبو سكريد 100 إيبوكسي سكريد بني 28 كغ',
      en: 'Sodamco Weber Floor Epo Screed 100 Brown 28 KG',
    },
    slug: 'weber-floor-epo-screed-100',
    description: {
      ar: 'مونة سكريد إيبوكسي ثنائية المكوّن لأرضيات صناعية شديدة التحمل.',
      en: 'Two component epoxy screed mortar for heavy duty industrial floor toppings.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['Brown'] },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['28'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009232',
        label: {
          ar: 'فلور ايبو سكريد 100 بني 28 كغ',
          en: 'Floor Epo Screed 100 Brown 28 KG',
        },
        price: 0,
        stock: 100,
        attributes: { color: 'Brown', weight: { value: 28, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 28000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر فلور ايبو سيل بلس أساس إيبوكسي 12 كغ',
      en: 'Sodamco Weber Floor Epo Sil Plus 12 KG',
    },
    slug: 'weber-floor-epo-sil-plus',
    description: {
      ar: 'مادة إغلاق وأساس إيبوكسي ثنائية المكوّن للأرضيات الخرسانية قبل الطلاء.',
      en: 'Two component epoxy sealer and primer for concrete floors prior to coating.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['12'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009233',
        label: {
          ar: 'فلور ايبو سيل بلس 12 كغ',
          en: 'Floor Epo Sil Plus 12 KG',
        },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 12, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 12000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر فلور ايبو برايم اس اف أساس إيبوكسي 16 لتر',
      en: 'Sodamco Weber Floor Epo Prime SF 16 LTR',
    },
    slug: 'weber-floor-epo-prime-sf',
    description: {
      ar: 'برايمر إيبوكسي ثنائي المكوّن خالٍ من المذيبات للأرضيات الخرسانية والسكريد.',
      en: 'Solvent free two component epoxy primer for concrete floors and screeds.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['16'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009306',
        label: {
          ar: 'فلور ايبو برايم اس اف 16 لتر',
          en: 'Floor Epo Prime SF 16 LTR',
        },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 16, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 20500,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر فلور توب كوت بي يو بولي يوريثان شفاف 18 لتر',
      en: 'Sodamco Weber Floor Top Coat PU Transparent 18 LTR',
    },
    slug: 'weber-floor-top-coat-pu',
    description: {
      ar: 'طبقة نهائية شفافة من البولي يوريثان ثنائية المكوّن مقاومة للأشعة فوق البنفسجية والبري.',
      en: 'Two component transparent polyurethane top coat providing UV and abrasion resistance.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['Transparent'] },
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['18'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009242',
        label: {
          ar: 'فلور توب كوت بي يو شفاف 18 لتر',
          en: 'Floor Top Coat PU Transparent 18 LTR',
        },
        price: 0,
        stock: 100,
        attributes: {
          color: 'Transparent',
          volume: { value: 18, unit: 'ltr' },
        },
        shippingProfile: {
          weightGrams: 23000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر فلور 400 هاردينر مقوي أرضيات',
      en: 'Sodamco Weber Floor 400 BA Floor Hardener',
    },
    slug: 'weber-floor-400-ba',
    description: {
      ar: 'مقوي أسطح جاف يُنثر على الخرسانة لزيادة مقاومة الأرضيات للبري والتآكل.',
      en: 'Dry shake metallic-free surface hardener that increases abrasion resistance of concrete floors.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['25', '50'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300992',
        label: { ar: 'فلور 400 هاردينر 25 كغ', en: 'Floor 400 BA 25 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009195',
        label: { ar: 'فلور 400 هاردينر 50 كغ', en: 'Floor 400 BA 50 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر فلور 514 سيلف ليفل 25 كغ',
      en: 'Sodamco Weber Floor 514 SL 25 KG',
    },
    slug: 'weber-floor-514-sl',
    description: {
      ar: 'مونة إسمنتية ذاتية التسوية لتنعيم الأرضيات قبل التشطيبات النهائية.',
      en: 'Cementitious self levelling underlayment for smoothing floors before final finishes.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['25'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300919',
        label: { ar: 'فلور 514 سيلف ليفل 25 كغ', en: 'Floor 514 SL 25 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر فلور ليفل اف اتش سيلف ليفل 25 كغ',
      en: 'Sodamco Weber Floor Level FH 25 KG',
    },
    slug: 'weber-floor-level-fh',
    description: {
      ar: 'سكريد إسمنتي ذاتي التسوية عالي السيولة للأرضيات الداخلية بسماكة 1 إلى 10 مم.',
      en: 'High flow self levelling cementitious screed for interior floors, 1 to 10 mm.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['25'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009234',
        label: { ar: 'فلور ليفل اف اتش 25 كغ', en: 'Floor Level FH 25 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر فلور 600 اس سي ار سكريد 50 كغ',
      en: 'Sodamco Weber Floor 600 SCR 50 KG',
    },
    slug: 'weber-floor-600-scr',
    description: {
      ar: 'مونة سكريد إسمنتية جاهزة لتسوية الأرضيات قبل التبليط.',
      en: 'Ready mixed cementitious screed mortar for levelling floors prior to tiling.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['50'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009197',
        label: { ar: 'فلور 600 اس سي ار 50 كغ', en: 'Floor 600 SCR 50 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر فلور رابيد سكريد 50 كغ',
      en: 'Sodamco Weber Floor Rapid Screed 50 KG',
    },
    slug: 'weber-floor-rapid',
    description: {
      ar: 'سكريد إسمنتي سريع التصلد يسمح بالمرور والتشطيب مبكراً.',
      en: 'Rapid hardening cementitious screed allowing early trafficking and finishing.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['50'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300993',
        label: { ar: 'فلور رابيد سكريد 50 كغ', en: 'Floor Rapid 50 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر فلور 4716 أساس أرضيات 5 لتر',
      en: 'Sodamco Weber Floor 4716 White 5 LTR',
    },
    slug: 'weber-floor-4716',
    description: {
      ar: 'برايمر أرضيات أكريليكي ينظّم امتصاص السطح قبل تطبيق مونة التسوية.',
      en: 'Acrylic floor primer that regulates absorption before applying levelling screeds.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['White'] },
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['5'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '202300920',
        label: { ar: 'فلور 4716 أبيض 5 لتر', en: 'Floor 4716 White 5 LTR' },
        price: 0,
        stock: 100,
        attributes: { color: 'White', volume: { value: 5, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 6400,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر فلور سيل اس رمل سيليكا 15 كغ',
      en: 'Sodamco Weber Floor SIL S Silica Sand 15 KG',
    },
    slug: 'weber-floor-sil-s',
    description: {
      ar: 'رمل سيليكا مدرّج يُستخدم في سكريد الإيبوكسي وطبقات مقاومة الانزلاق.',
      en: 'Graded silica sand aggregate for epoxy screeds and anti slip broadcast finishes.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['15'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009241',
        label: { ar: 'فلور سيل اس 15 كغ', en: 'Floor SIL S 15 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 15, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 15000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر برايم اي بي 2 كي أساس بولي يوريثان',
      en: 'Sodamco Weber Prim EP 2 K Epoxy Primer',
    },
    slug: 'weber-prim-ep-2k',
    description: {
      ar: 'برايمر إيبوكسي ثنائي المكوّن كطبقة أساس تحت أنظمة العزل بالبولي يوريثان.',
      en: 'Two component epoxy primer used as a base coat under polyurethane waterproofing systems.',
    },
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['4', '20'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300990',
        label: { ar: 'برايم اي بي 2 كي 4 كغ', en: 'Prim EP 2 K 4 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300991',
        label: { ar: 'برايم اي بي 2 كي 20 كغ', en: 'Prim EP 2 K 20 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 20, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 20000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر تيك ام سي 1 خرسانة جاهزة',
      en: 'Sodamco Weber Tec MC 1 Ready Mixed Concrete',
    },
    slug: 'weber-tec-mc-1',
    description: {
      ar: 'خرسانة جافة جاهزة تحتاج إضافة الماء فقط لأعمال الصب الصغيرة والترميم.',
      en: 'Ready mixed dry concrete requiring only the addition of water for small pours and repairs.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['25', '50'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009309',
        label: {
          ar: 'تيك ام سي 1 خرسانة جاهزة 25 كغ',
          en: 'Tec MC 1 Concrete 25 KG',
        },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009196',
        label: {
          ar: 'تيك ام سي 1 خرسانة جاهزة 50 كغ',
          en: 'Tec MC 1 Concrete 50 KG',
        },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 50, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 50000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر تيك بوند مادة ربط',
      en: 'Sodamco Weber Tec Bond Bonding Agent',
    },
    slug: 'weber-tec-bond',
    description: {
      ar: 'مادة ربط أكريليكية تشكّل جسر التصاق بين الخرسانة القديمة والجديدة.',
      en: 'Acrylic bonding agent creating an adhesive bridge between old and new concrete.',
    },
    subCategorySlug: 'concrete-admixtures',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['5', '20'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '202300961',
        label: { ar: 'تيك بوند 5 لتر', en: 'Tec Bond 5 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 5, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 6400,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300960',
        label: { ar: 'تيك بوند 20 لتر', en: 'Tec Bond 20 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر تيك 301 جراوت 25 كغ',
      en: 'Sodamco Weber Tec 301 Grout 25 KG',
    },
    slug: 'weber-tec-301-grout',
    description: {
      ar: 'جراوت إسمنتي غير منكمش لقواعد المعدات ومسامير التثبيت والفراغات الإنشائية.',
      en: 'Non shrink cementitious grout for base plates, anchor bolts and structural gaps.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['25'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300949',
        label: { ar: 'تيك 301 جراوت 25 كغ', en: 'Tec 301 Grout 25 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر تيك ايبو بوند إيبوكسي بوند 4.65 كغ',
      en: 'Sodamco Weber Tec Epo Bond 4.65 KG',
    },
    slug: 'weber-tec-epo-bond',
    description: {
      ar: 'مادة ربط إيبوكسي ثنائية المكوّن للالتصاق الإنشائي بين طبقات الصب.',
      en: 'Two component epoxy bonding agent for structural adhesion between concrete pours.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['4.65'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009269',
        label: { ar: 'تيك ايبو بوند 4.65 كغ', en: 'Tec Epo Bond 4.65 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 4.65, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4650,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر ريب ايبو 412 كري بلس معجون إيبوكسي',
      en: 'Sodamco Weber Ep Epo 412 CRY Plus Epoxy Putty',
    },
    slug: 'weber-ep-epo-412-cry-plus',
    description: {
      ar: 'معجون إيبوكسي ثنائي المكوّن لملء التعشيش والفراغات والعيوب الإنشائية.',
      en: 'Two component epoxy putty for filling honeycombs, blowholes and structural defects.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['1', '6'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300911',
        label: {
          ar: 'ريب ايبو 412 كري بلس 1 كغ',
          en: 'Ep Epo 412 CRY Plus 1 KG',
        },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 1, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 1000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '202300912',
        label: {
          ar: 'ريب ايبو 412 كري بلس 6 كغ',
          en: 'Ep Epo 412 CRY Plus 6 KG',
        },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 6, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 6000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر ريب ايبو 410 مونة معالجة إيبوكسي 27.80 كغ',
      en: 'Sodamco Weber EP Epo 410 Epoxy Repair Mortar 27.80 KG',
    },
    slug: 'weber-ep-epo-410',
    description: {
      ar: 'مونة ترميم إيبوكسي ثلاثية المكوّنات لإصلاح الخرسانة الإنشائية المعرّضة للمواد الكيميائية.',
      en: 'Three component epoxy repair mortar for structural concrete repairs under chemical exposure.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['27.8'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009150',
        label: {
          ar: 'ريب ايبو 410 - 27.80 كغ',
          en: 'EP Epo 410 Epoxy Repair Mortar 27.80 KG',
        },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 27.8, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 27800,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر ريب ايبو 420 اس سي 38 كغ',
      en: 'Sodamco Weber Ep Epo 420 SC 38 KG',
    },
    slug: 'weber-ep-epo-420-sc',
    description: {
      ar: 'مونة سكريد إيبوكسي ثلاثية المكوّنات للترميمات الصناعية المقاومة للكيماويات.',
      en: 'Three component epoxy screed mortar for chemically resistant industrial repairs.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['38'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009133',
        label: { ar: 'ريب ايبو 420 اس سي 38 كغ', en: 'Ep Epo 420 SC 38 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 38, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 38000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر ريب 370 بي اف مضاد صدأ 4 كغ',
      en: 'Sodamco Weber EP 370 PF 4 KG',
    },
    slug: 'weber-ep-370-pf',
    description: {
      ar: 'طلاء حماية مضاد للصدأ يُدهن على حديد التسليح المكشوف قبل الترميم.',
      en: 'Anti corrosion protective coating applied to exposed reinforcement steel before patch repair.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['4'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300957',
        label: { ar: 'ريب 370 بي اف 4 كغ', en: 'EP 370 PF 4 KG' },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 4, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 4000,
          packageType: PackageType.GALLON,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر ريب 501 مضاد صدأ زينك ريتش 4 لتر',
      en: 'Sodamco Weber EP 501 ZRP Zinc Rich Primer 4 LTR',
    },
    slug: 'weber-ep-501-zrp',
    description: {
      ar: 'برايمر إيبوكسي ثنائي المكوّن غني بالزنك يوفر حماية كاثودية لحديد التسليح.',
      en: 'Two component zinc rich epoxy primer giving cathodic protection to steel reinforcement.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['4'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '202300925',
        label: { ar: 'ريب 501 زينك ريتش 4 لتر', en: 'EP 501 ZRP 4 LTR' },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 4, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 5100,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر بافمينت 600 سميك 25 كغ',
      en: 'Sodamco Weber Pavement 600 Thick REF 25 KG',
    },
    slug: 'weber-pavement-600',
    description: {
      ar: 'مونة فرش سميكة لتركيب الإنترلوك وبلاط الأرصفة شديد التحمل.',
      en: 'Thick bed bedding mortar for laying interlock pavers and heavy duty paving slabs.',
    },
    subCategorySlug: 'repair-mortars-grouts',
    allowedAttributes: [
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['25'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009107',
        label: {
          ar: 'بافمينت 600 سميك 25 كغ',
          en: 'Pavement 600 Thick REF 25 KG',
        },
        price: 0,
        stock: 100,
        attributes: { weight: { value: 25, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 25000,
          packageType: PackageType.BAG,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر بولي اتش بولوريا هايبرد رمادي 400 كغ',
      en: 'Sodamco Weber Poly H Hybrid Polyurea Grey 400 KG',
    },
    slug: 'weber-poly-h',
    description: {
      ar: 'غشاء بولي يوريا هجين ثنائي المكوّن يُرش وسريع التصلد للعزل شديد التحمل.',
      en: 'Two component hybrid polyurea spray membrane for fast curing heavy duty waterproofing.',
    },
    subCategorySlug: 'polyurethane-polyurea',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['Gray'] },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['400'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '2023009261',
        label: { ar: 'بولي اتش رمادي 400 كغ', en: 'Poly H Grey 400 KG' },
        price: 0,
        stock: 100,
        attributes: { color: 'Gray', weight: { value: 400, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 400000,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر كوت بروتكت اي بي سي إيبوكسي بولي سلفايد 15 لتر',
      en: 'Sodamco Weber Cote Protect EPC Epoxy Polysulphide 15 LTR',
    },
    slug: 'weber-cote-protect-epc',
    description: {
      ar: 'دهان حماية إيبوكسي بولي سلفايد ثنائي المكوّن للخرسانة المعرّضة للصرف والكيماويات.',
      en: 'Two component epoxy polysulphide protective coating for concrete exposed to sewage and chemicals.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['Gray', 'Black'] },
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['15'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009302',
        label: {
          ar: 'كوت بروتكت اي بي سي رمادي 15 لتر',
          en: 'Cote Protect EPC Gray 15 LTR',
        },
        price: 0,
        stock: 100,
        attributes: { color: 'Gray', volume: { value: 15, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 19200,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009303',
        label: {
          ar: 'كوت بروتكت اي بي سي أسود 15 لتر',
          en: 'Cote Protect EPC Black 15 LTR',
        },
        price: 0,
        stock: 100,
        attributes: { color: 'Black', volume: { value: 15, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 19200,
          packageType: PackageType.BOX,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر سويلكس 200 مثبت تربة',
      en: 'Sodamco Weber Soilex 200 Soil Stabilizer',
    },
    slug: 'weber-soilex-200',
    description: {
      ar: 'مثبّت تربة بوليمري يربط الرمال والأتربة للحد من الانجراف في الأراضي المكشوفة.',
      en: 'Polymer soil stabiliser that binds sand and dust to control erosion on open ground.',
    },
    subCategorySlug: 'liquid-waterproofing',
    allowedAttributes: [
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['20', '200'],
        allowedUnits: ['ltr'],
      },
    ],
    variants: [
      {
        sku: '2023009267',
        label: {
          ar: 'سويلكس 200 مثبت تربة 20 لتر',
          en: 'Soilex 200 Soil Stabilizer 20 LTR',
        },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 20, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 25600,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
      {
        sku: '2023009268',
        label: {
          ar: 'سويلكس 200 مثبت تربة 200 لتر',
          en: 'Soilex 200 Soil Stabilizer 200 LTR',
        },
        price: 0,
        stock: 100,
        attributes: { volume: { value: 200, unit: 'ltr' } },
        shippingProfile: {
          weightGrams: 256000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر باند 12 سم * 10 متر',
      en: 'Sodamco Weber Band 12 CM * 10 M',
    },
    slug: 'weber-band',
    description: {
      ar: 'شريط تقوية مرن يُدمج مع مواد العزل عند الزوايا وفواصل الحركة.',
      en: 'Flexible reinforcing tape bedded into waterproofing membranes at corners and movement joints.',
    },
    subCategorySlug: 'joint-sealants',
    allowedAttributes: [
      {
        name: 'length',
        type: 'number',
        allowedValues: ['10'],
        allowedUnits: ['m'],
      },
    ],
    variants: [
      {
        sku: '202300995',
        label: { ar: 'باند 12 سم * 10 متر', en: 'Band 12 CM * 10 M' },
        price: 0,
        stock: 100,
        attributes: { length: { value: 10, unit: 'm' } },
        shippingProfile: {
          weightGrams: 1500,
          packageType: PackageType.ROLL,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر جوينت سيل أكريليك معجون فواصل رمادي 18 كغ',
      en: 'Sodamco Weber Joint Seal Acrylic Grey 18 KG',
    },
    slug: 'weber-joint-seal-acrylic',
    description: {
      ar: 'معجون أكريليكي لملء الفواصل الثابتة والشقوق قبل التشطيب.',
      en: 'Acrylic joint filling compound for sealing non moving joints and cracks before finishing.',
    },
    subCategorySlug: 'joint-sealants',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['Grey'] },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['18'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300947',
        label: {
          ar: 'جوينت سيل أكريليك رمادي 18 كغ',
          en: 'Joint Seal Acrylic Grey 18 KG',
        },
        price: 0,
        stock: 100,
        attributes: { color: 'Grey', weight: { value: 18, unit: 'kg' } },
        shippingProfile: {
          weightGrams: 18000,
          packageType: PackageType.DRUM,
          quantityPerPackage: 1,
        },
      },
    ],
  },
  {
    title: {
      ar: 'سودامكو ويبر سيلكون اف اس سيلكون ضد الحريق أبيض 280 مل',
      en: 'Sodamco Weber Silcone FS Fire Rated White 280 ML',
    },
    slug: 'weber-silicone-fs',
    description: {
      ar: 'سيلكون مقاوم للحريق لفواصل المحيط وتطبيقات إيقاف انتشار النار.',
      en: 'Fire rated silicone sealant for perimeter joints and fire stopping applications.',
    },
    subCategorySlug: 'joint-sealants',
    allowedAttributes: [
      { name: 'color', type: 'string', allowedValues: ['White'] },
      {
        name: 'volume',
        type: 'number',
        allowedValues: ['280'],
        allowedUnits: ['ml'],
      },
    ],
    variants: [
      {
        sku: '2023009135',
        label: {
          ar: 'سيلكون اف اس أبيض 280 مل',
          en: 'Silcone FS White 280 ML',
        },
        price: 0,
        stock: 100,
        attributes: { color: 'White', volume: { value: 280, unit: 'ml' } },
        shippingProfile: {
          weightGrams: 398,
          packageType: PackageType.PIECE,
          quantityPerPackage: 24,
        },
      },
    ],
  },
];
