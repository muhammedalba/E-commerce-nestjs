import { PackageType } from '../products/shared/schemas/shipping-profile.schema';

export interface CatalogVariant {
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

export interface CatalogProductFamily {
  title: { ar: string; en: string };
  slug: string;
  description: { ar: string; en: string };
  brandSlug: string;
  categorySlug: string;
  subCategorySlug: string;
  allowedAttributes: Array<{
    name: string;
    type: 'string' | 'number';
    allowedValues?: string[];
    allowedUnits?: string[];
  }>;
  variants: CatalogVariant[];
}

export interface CatalogCategory {
  name: { ar: string; en: string };
  slug: string;
  subCategories: Array<{
    name: { ar: string; en: string };
    slug: string;
  }>;
}

export interface CatalogBrand {
  name: { ar: string; en: string };
  slug: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Core Categories & SubCategories
// ─────────────────────────────────────────────────────────────────────────────
export const FULL_CATALOG_CATEGORIES: CatalogCategory[] = [
  {
    name: {
      ar: 'عوازل مائية وحماية الأسطح',
      en: 'Waterproofing & Protection Systems',
    },
    slug: 'waterproofing-protection',
    subCategories: [
      {
        name: {
          ar: 'لفائف بيتومينية وممبرين',
          en: 'Bituminous Membranes & Rolls',
        },
        slug: 'bituminous-membranes',
      },
      {
        name: {
          ar: 'دهانات ومستحلبات عزل مائي',
          en: 'Liquid Waterproofing & Primers',
        },
        slug: 'liquid-waterproofing',
      },
      {
        name: {
          ar: 'عوازل إسمنتية وتبلور',
          en: 'Cementitious & Crystalline Waterproofing',
        },
        slug: 'cementitious-waterproofing',
      },
      {
        name: {
          ar: 'عوازل بولي يوريثان وبوليوريا',
          en: 'Polyurethane & Polyurea Coatings',
        },
        slug: 'polyurethane-polyurea',
      },
      {
        name: { ar: 'ألواح حماية العزل', en: 'Protection Boards' },
        slug: 'protection-boards',
      },
      {
        name: {
          ar: 'عوازل حقن خرسانة وفوم',
          en: 'Concrete Injection & Waterstop',
        },
        slug: 'injection-waterstop',
      },
    ],
  },
  {
    name: {
      ar: 'العوازل الحرارية والصوتية',
      en: 'Thermal & Acoustic Insulation',
    },
    slug: 'thermal-acoustic-insulation',
    subCategories: [
      {
        name: {
          ar: 'ألواح عازل حراري XPS',
          en: 'Extruded Polystyrene XPS Boards',
        },
        slug: 'xps-insulation-boards',
      },
      {
        name: {
          ar: 'الصوف الصخري والزجاجي',
          en: 'Rockwool & Glasswool Insulation',
        },
        slug: 'rockwool-glasswool',
      },
      {
        name: {
          ar: 'فلين هوردي وبوليسترين متمدد',
          en: 'Hordy Cork & Expanded Polystyrene',
        },
        slug: 'hordy-cork',
      },
      {
        name: { ar: 'عوازل صوت ومطاط', en: 'Acoustic Insulation & XLPE' },
        slug: 'acoustic-insulation',
      },
    ],
  },
  {
    name: {
      ar: 'أقمشة الجيوتكستايل وبلاستيك البناء',
      en: 'Geotextiles & Polyethylene Sheets',
    },
    slug: 'geotextiles-polyethylene',
    subCategories: [
      {
        name: { ar: 'ألياف جيوتكستايل', en: 'Geotextile Fabrics' },
        slug: 'geotextiles',
      },
      {
        name: {
          ar: 'شبكات جيو جريد وتثبيت التربة',
          en: 'Geogrids & Soil Stabilization',
        },
        slug: 'geogrids',
      },
      {
        name: { ar: 'لفائف بلاستيك بولي إيثيلين', en: 'Polyethylene Sheets' },
        slug: 'polyethylene-sheets',
      },
      {
        name: { ar: 'أغشية تبطين HDPE وممبرين', en: 'HDPE Geomembranes' },
        slug: 'hdpe-membranes',
      },
    ],
  },
  {
    name: {
      ar: 'كيميائيات البناء وإصلاح الخرسانة',
      en: 'Construction Chemicals & Concrete Repair',
    },
    slug: 'construction-chemicals-repair',
    subCategories: [
      {
        name: {
          ar: 'مواد تزريع حديد وتثبيت إيبوكسي',
          en: 'Chemical Anchors & Resins',
        },
        slug: 'chemical-anchors',
      },
      {
        name: {
          ar: 'مورتر وجراوت إصلاح الخرسانة',
          en: 'Repair Mortars & Non-Shrink Grouts',
        },
        slug: 'repair-mortars-grouts',
      },
      {
        name: {
          ar: 'إضافات خرسانة وموانع التصاق',
          en: 'Admixtures & Mould Release Agents',
        },
        slug: 'concrete-admixtures',
      },
      {
        name: {
          ar: 'خامات فوم وبولي يوريثان خام',
          en: 'Spray Foam Raw Chemicals',
        },
        slug: 'foam-raw-chemicals',
      },
    ],
  },
  {
    name: {
      ar: 'دهانات الأرضيات وفواصل التمدد',
      en: 'Flooring, Epoxies & Expansion Joints',
    },
    slug: 'flooring-expansion-joints',
    subCategories: [
      {
        name: {
          ar: 'إيبوكسي ودهانات أرضيات وخزانات',
          en: 'Floor & Tank Epoxy Coatings',
        },
        slug: 'epoxy-flooring-tanks',
      },
      {
        name: {
          ar: 'سيلنت ومعجون فواصل التمدد',
          en: 'Joint Sealants & Mastics',
        },
        slug: 'joint-sealants',
      },
      {
        name: {
          ar: 'فلين وسولينج بار فواصل',
          en: 'Backing Rods & Swelling Bars',
        },
        slug: 'backing-rods',
      },
      {
        name: {
          ar: 'شرائح وفلاشينج ألمنيوم',
          en: 'Aluminum Flashings & Profiles',
        },
        slug: 'aluminum-flashings',
      },
      {
        name: {
          ar: 'ترويبات وغراء بلاط وسيراميك',
          en: 'Tile Adhesives & Grouts',
        },
        slug: 'tile-adhesives-grouts',
      },
      {
        name: { ar: 'دهانات طرق وعلامات مرورية', en: 'Road Marking Paints' },
        slug: 'road-marking-paints',
      },
    ],
  },
  {
    name: {
      ar: 'العدد والأدوات ومستلزمات المواقع',
      en: 'Tools, Hardware & Site Supplies',
    },
    slug: 'tools-hardware-supplies',
    subCategories: [
      {
        name: { ar: 'عدد وأدوات كهربائية', en: 'Power Tools' },
        slug: 'power-tools',
      },
      {
        name: {
          ar: 'أدوات يدوية ومعدات دهان ونجارة',
          en: 'Hand Tools & Paint Accessories',
        },
        slug: 'hand-tools',
      },
      {
        name: {
          ar: 'ماكينات رش وحقن متخصصة',
          en: 'Spray & Injection Machines',
        },
        slug: 'specialized-machines',
      },
      {
        name: { ar: 'مسامير وبراغي ومثبتات', en: 'Nails, Screws & Fasteners' },
        slug: 'fasteners-anchors',
      },
      {
        name: {
          ar: 'أخشاب وسقالات وشدات',
          en: 'Timber, Plywood & Scaffolding',
        },
        slug: 'timber-plywood',
      },
      {
        name: {
          ar: 'مهمات سلامة ومستلزمات عامة',
          en: 'Safety & Site Accessories',
        },
        slug: 'safety-supplies',
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. Catalog Brands Extracted from File
// ─────────────────────────────────────────────────────────────────────────────
export const FULL_CATALOG_BRANDS: CatalogBrand[] = [
  {
    name: { ar: 'إكسسوارات ومستلزمات', en: 'Accessories' },
    slug: 'accessories',
  },
  { name: { ar: 'فوسام فوسروك', en: 'Fosroc' }, slug: 'fosroc' },
  { name: { ar: 'دي سي بي', en: 'DCP' }, slug: 'dcp' },
  { name: { ar: 'سابتكس', en: 'Saptex' }, slug: 'saptex' },
  { name: { ar: 'بونار ناتبيت', en: 'Bonar Natpet' }, slug: 'bonar-natpet' },
  { name: { ar: 'سيكا', en: 'Sika' }, slug: 'sika' },
  { name: { ar: 'ديرمابيت', en: 'Dermabit' }, slug: 'dermabit' },
  { name: { ar: 'ماكينات ومعدات', en: 'Machines' }, slug: 'machines' },
  { name: { ar: 'سودامكو ويبر', en: 'Sodamco Weber' }, slug: 'weber-sodamco' },
  { name: { ar: 'باسف', en: 'BASF' }, slug: 'basf' },
  { name: { ar: 'عوازل الخليج', en: 'Gulf Seal' }, slug: 'gulf-seal' },
  { name: { ar: 'كي بي اي', en: 'KPI' }, slug: 'kpi' },
  { name: { ar: 'معدات وإبر الحقن', en: 'Injection' }, slug: 'injection' },
  { name: { ar: 'هينكل', en: 'Henkel' }, slug: 'henkel' },
  { name: { ar: 'سي ام سي اي', en: 'CMCI' }, slug: 'cmci' },
  { name: { ar: 'بي سي اي', en: 'BCI' }, slug: 'bci' },
  { name: { ar: 'دادكو', en: 'DADCO' }, slug: 'dadco' },
  { name: { ar: 'إيزو ماكس', en: 'Izomaks' }, slug: 'izomaks' },
  { name: { ar: 'سيلفر', en: 'Silver' }, slug: 'silver' },
  {
    name: { ar: 'سكاي بروتكشن كارتونال', en: 'SKY Protection Cartonal' },
    slug: 'sky-protection-cartonal',
  },
  { name: { ar: 'الاتحاد', en: 'Ittihad' }, slug: 'ittihad' },
  { name: { ar: 'ماتكس', en: 'Mattex' }, slug: 'mattex' },
  { name: { ar: 'دلمون', en: 'Delmon' }, slug: 'delmon' },
  { name: { ar: 'كيم كريت', en: 'Chem Crete' }, slug: 'chem-crete' },
  { name: { ar: 'بيتومات', en: 'Bitumat' }, slug: 'bitumat' },
  { name: { ar: 'داو', en: 'DOW' }, slug: 'dow' },
  { name: { ar: 'إنسوراب', en: 'Insuwrap' }, slug: 'insuwrap' },
  { name: { ar: 'درايزورو', en: 'Drizoro' }, slug: 'drizoro' },
  { name: { ar: 'إيسكو فوم', en: 'Esco Foam' }, slug: 'esco-foam' },
  { name: { ar: 'أركي', en: 'Arki' }, slug: 'arki' },
  { name: { ar: 'سافيتو', en: 'Saveto' }, slug: 'saveto' },
  { name: { ar: 'باكب رود', en: 'Backing Rod' }, slug: 'backing-rod' },
  { name: { ar: 'مصنع أنقى', en: 'ANQA Factory' }, slug: 'anqa-factory' },
  { name: { ar: 'سوكو', en: 'Succo' }, slug: 'succo' },
  { name: { ar: 'تاج وتكنو', en: 'TAJ Techno' }, slug: 'taj-techno' },
  { name: { ar: 'ستار', en: 'STAR' }, slug: 'star' },
  { name: { ar: 'العوازل العربية', en: 'Awazel' }, slug: 'awazel' },
  { name: { ar: 'سي اي سي', en: 'CIC' }, slug: 'cic' },
  { name: { ar: 'بوليوريا', en: 'Polyurea' }, slug: 'polyurea' },
  { name: { ar: 'إعمار', en: 'EMAAR' }, slug: 'emaar' },
  { name: { ar: 'تريمكو', en: 'Tremco' }, slug: 'tremco' },
  {
    name: { ar: 'الشركة السعودية للعوازل', en: 'Saudi Insulation' },
    slug: 'saudi-insulation',
  },
  { name: { ar: 'سابت', en: 'SABIT' }, slug: 'sabit' },
  { name: { ar: 'ديرماكس', en: 'Dermax' }, slug: 'dermax' },
  { name: { ar: 'ألياف', en: 'Alyaf' }, slug: 'alyaf' },
  { name: { ar: 'ام سي', en: 'MC' }, slug: 'mc' },
  { name: { ar: 'أرنون', en: 'Arnon' }, slug: 'arnon' },
  { name: { ar: 'الجودة الأفضل', en: 'Best Quality' }, slug: 'best-quality' },
  {
    name: { ar: 'بانجين يو وانغ', en: 'Panjin Yu Wang' },
    slug: 'panjin-yu-wang',
  },
  { name: { ar: 'فلين هوردي', en: 'Hordy Cork' }, slug: 'hordy-cork-brand' },
  { name: { ar: 'سكاي فلاشينج', en: 'SKY FLASHING' }, slug: 'sky-flashing' },
  {
    name: { ar: 'سكاي شيت بولي إيثيلين', en: 'SKY Sheet Polyethylene' },
    slug: 'sky-sheet-polyethylene',
  },
  { name: { ar: 'الكيميكا', en: 'ALCHIMICA' }, slug: 'alchimica' },
  { name: { ar: 'بيلكوم', en: 'Builchem' }, slug: 'builchem' },
  { name: { ar: 'مابي', en: 'MAPEI' }, slug: 'mapei' },
  {
    name: { ar: 'بي سي اي للكيماويات', en: 'Building Chemistry BCI' },
    slug: 'building-chemistry-bci',
  },
  { name: { ar: 'فابكو', en: 'Fabco' }, slug: 'fabco' },
  { name: { ar: 'نارسيس', en: 'Narcisi' }, slug: 'narcisi' },
  { name: { ar: 'أكريليك عوازل', en: 'Acrylic' }, slug: 'acrylic-insulation' },
  { name: { ar: 'جلاكسي', en: 'Galaxy' }, slug: 'galaxy' },
  { name: { ar: 'سودال', en: 'Soudal' }, slug: 'soudal' },
  { name: { ar: 'العايد تكنو', en: 'Techno' }, slug: 'techno' },
  { name: { ar: 'كيم فيكس', en: 'CHEM FIX' }, slug: 'chem-fix' },
  { name: { ar: 'بي بي سي', en: 'BPC' }, slug: 'bpc' },
  { name: { ar: 'دلبا', en: 'DALBA' }, slug: 'dalba' },
  { name: { ar: 'الراشد', en: 'AL RASHED' }, slug: 'al-rashed' },
  { name: { ar: 'ثقة', en: 'Thiqa' }, slug: 'thiqa' },
  { name: { ar: 'جفالي', en: 'JUFFALI' }, slug: 'juffali' },
  { name: { ar: 'الأهلية', en: 'AL AHLIAH' }, slug: 'al-ahliah' },
  { name: { ar: 'غندورة', en: 'GHANDOURA' }, slug: 'ghandoura' },
  { name: { ar: 'إكس كيم', en: 'X Chem' }, slug: 'x-chem' },
  { name: { ar: 'فيلر بورد', en: 'Filler Board' }, slug: 'filler-board' },
  { name: { ar: 'الجازع', en: 'Al Jazea JCC' }, slug: 'al-jazea-jcc' },
  { name: { ar: 'بوستيك', en: 'Bostik' }, slug: 'bostik' },
  { name: { ar: 'كيم كوت', en: 'Chem Kote' }, slug: 'chem-kote' },
  { name: { ar: 'هيلتي', en: 'HILTI' }, slug: 'hilti' },
  {
    name: { ar: 'البيرلايت السعودي', en: 'Saudi Perlite' },
    slug: 'saudi-perlite',
  },
  { name: { ar: 'يابي ميكس', en: 'YAPIMIX' }, slug: 'yapimix' },
  { name: { ar: 'روافد الحقول', en: 'Roafd Al Hqol' }, slug: 'roafd-al-hqol' },
  { name: { ar: 'سولينج بار', en: 'Swelling Bar' }, slug: 'swelling-bar' },
  { name: { ar: 'كيمكو إيزوفر', en: 'Kimmco Isover' }, slug: 'kimmco-isover' },
  { name: { ar: 'أفيكو', en: 'Afico Glass Wool' }, slug: 'afico-glass-wool' },
  { name: { ar: 'تيم برو', en: 'Team Pro' }, slug: 'team-pro' },
  { name: { ar: 'ترايكو', en: 'Trico' }, slug: 'trico' },
  { name: { ar: 'ساند فيكس', en: 'Sand Fix' }, slug: 'sand-fix' },
  {
    name: { ar: 'جرافيتي ريزن', en: 'Graffiti Resin' },
    slug: 'graffiti-resin',
  },
  {
    name: { ar: 'سكاي ثيرمال شيلد', en: 'Sky Thermal Shield' },
    slug: 'sky-thermal-shield',
  },
  {
    name: { ar: 'دهانات الماسة', en: 'AL MASA PAINTS' },
    slug: 'al-masa-paints',
  },
  { name: { ar: 'دي دي اي', en: 'DDI' }, slug: 'ddi' },
  { name: { ar: 'بريزمو رود', en: 'Prismo Road' }, slug: 'prismo-road' },
  { name: { ar: 'سكاي تيكس', en: 'SKY TEX' }, slug: 'sky-tex' },
  {
    name: { ar: 'صناعات الشاهين', en: 'Alshahin Metal Industries' },
    slug: 'alshahin',
  },
  {
    name: { ar: 'بسكوت خرسانة', en: 'Concrete Biscuits' },
    slug: 'concrete-biscuits',
  },
  { name: { ar: 'فانديكس', en: 'VANDEX' }, slug: 'vandex' },
  { name: { ar: 'داماس', en: 'DAMAS' }, slug: 'damas' },
  {
    name: { ar: 'شركة الرمل الأبيض للصناعة', en: 'White Sand Industrial' },
    slug: 'white-sand-industrial',
  },
  { name: { ar: 'رواد للأنظمة البلاستيكية', en: 'ROWAD' }, slug: 'rowad' },
  { name: { ar: 'ريادة', en: 'RIYADA' }, slug: 'riyada' },
  { name: { ar: 'الشرق', en: 'AL SHARQ' }, slug: 'al-sharq' },
  { name: { ar: 'إف بي سي', en: 'FBC' }, slug: 'fbc' },
  { name: { ar: 'بينيترون', en: 'PENETRON' }, slug: 'penetron' },
  { name: { ar: 'هنتسمان', en: 'Huntsman' }, slug: 'huntsman' },
  { name: { ar: 'سابك', en: 'SABIC' }, slug: 'sabic' },
  { name: { ar: 'إيزو كور', en: 'ISO COR' }, slug: 'iso-cor' },
  { name: { ar: 'هيمبل', en: 'HEMPEL' }, slug: 'hempel' },
  { name: { ar: 'زات', en: 'ZAT' }, slug: 'zat' },
  { name: { ar: 'ريكتور سيل', en: 'Rector Seal' }, slug: 'rector-seal' },
  { name: { ar: 'فوم', en: 'Foam' }, slug: 'foam' },
  {
    name: { ar: 'توريدات عامة', en: 'Multiple Supply' },
    slug: 'multiple-supply',
  },
  { name: { ar: 'بوليان', en: 'poliane' }, slug: 'poliane' },
  { name: { ar: 'مالتي تيك', en: 'Multi Tech' }, slug: 'multi-tech' },
  { name: { ar: 'آي إن 8', en: 'IN 8' }, slug: 'in-8' },
  { name: { ar: 'ماكس راي', en: 'MAXRAY' }, slug: 'maxray' },
  { name: { ar: 'موجه مافكو', en: 'MOJAH MAFCO' }, slug: 'mojah-mafco' },
  { name: { ar: 'ساك', en: 'SAAK' }, slug: 'saak' },
  { name: { ar: 'كارلايل', en: 'Carlisle' }, slug: 'carlisle' },
  {
    name: { ar: 'أخشاب ومستلزمات نجارة', en: 'Wood & Timber' },
    slug: 'wood-timber',
  },
  { name: { ar: 'ساف', en: 'SAAF' }, slug: 'saaf' },
  { name: { ar: 'أشرطة لاصقة', en: 'Adhesive Tape' }, slug: 'adhesive-tape' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. Representative Product Families & Variants Covering Every Brand in the File
// ─────────────────────────────────────────────────────────────────────────────
export const FULL_CATALOG_PRODUCTS: CatalogProductFamily[] = [
  // ─── XPS Insulation Family (Saptex, Bitumat, Awazel, Dalba, Riyada, etc.) ───
  {
    title: {
      ar: 'ألواح عازل حراري سابتكس XPS',
      en: 'Saptex XPS Thermal Insulation Boards',
    },
    slug: 'saptex-xps-thermal-boards',
    description: {
      ar: 'ألواح بوليسترين مبثوق XPS عالية الكثافة لعزل الأسقف والجدران مقاس 125×60 سم.',
      en: 'High-density extruded polystyrene XPS boards for roof and wall thermal insulation (125cm x 60cm).',
    },
    brandSlug: 'saptex',
    categorySlug: 'thermal-acoustic-insulation',
    subCategorySlug: 'xps-insulation-boards',
    allowedAttributes: [
      { name: 'thickness', type: 'string', allowedValues: ['5 cm', '7.5 cm'] },
      {
        name: 'density',
        type: 'string',
        allowedValues: ['32-35 kg/m3', '35-40 kg/m3'],
      },
    ],
    variants: [
      {
        sku: '202300405',
        label: {
          ar: 'سابتكس XPS سماكة 5 سم ضغط 32-35',
          en: 'Saptex XPS 05 CM D32-35',
        },
        price: 28,
        stock: 500,
        attributes: { thickness: '5 cm', density: '32-35 kg/m3' },
        shippingProfile: {
          weightGrams: 1250,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 50 },
        },
      },
      {
        sku: '202300406',
        label: {
          ar: 'سابتكس XPS سماكة 7.5 سم ضغط 35-40',
          en: 'Saptex XPS 7.5 CM D35-40',
        },
        price: 39,
        stock: 450,
        attributes: { thickness: '7.5 cm', density: '35-40 kg/m3' },
        shippingProfile: {
          weightGrams: 2000,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 75 },
        },
      },
    ],
  },
  {
    title: {
      ar: 'ألواح عازل حراري بيتومات بيتو ثيرم XPS',
      en: 'Bitumat Bitu Therm XPS Boards',
    },
    slug: 'bitumat-bitu-therm-xps-boards',
    description: {
      ar: 'ألواح عزل حراري بثق بيتومات مقاس 125×60 سم ضغط 32-35 كغ/م3 بسماكات متعددة.',
      en: 'Bitumat extruded polystyrene thermal insulation boards 125x60cm D32-35 kg/m3.',
    },
    brandSlug: 'bitumat',
    categorySlug: 'thermal-acoustic-insulation',
    subCategorySlug: 'xps-insulation-boards',
    allowedAttributes: [
      {
        name: 'thickness',
        type: 'string',
        allowedValues: ['4 cm', '5 cm', '6 cm', '10 cm'],
      },
      { name: 'density', type: 'string', allowedValues: ['32-35 kg/m3'] },
    ],
    variants: [
      {
        sku: '202302515',
        label: { ar: 'بيتومات XPS سماكة 4 سم', en: 'Bitumat XPS 04 CM' },
        price: 24,
        stock: 300,
        attributes: { thickness: '4 cm', density: '32-35 kg/m3' },
        shippingProfile: {
          weightGrams: 1000,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 40 },
        },
      },
      {
        sku: '202302508',
        label: { ar: 'بيتومات XPS سماكة 5 سم', en: 'Bitumat XPS 05 CM' },
        price: 29,
        stock: 400,
        attributes: { thickness: '5 cm', density: '32-35 kg/m3' },
        shippingProfile: {
          weightGrams: 1250,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 50 },
        },
      },
      {
        sku: '202302518',
        label: { ar: 'بيتومات XPS سماكة 6 سم', en: 'Bitumat XPS 06 CM' },
        price: 34,
        stock: 250,
        attributes: { thickness: '6 cm', density: '32-35 kg/m3' },
        shippingProfile: {
          weightGrams: 1500,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 60 },
        },
      },
      {
        sku: '202302519',
        label: { ar: 'بيتومات XPS سماكة 10 سم', en: 'Bitumat XPS 10 CM' },
        price: 52,
        stock: 200,
        attributes: { thickness: '10 cm', density: '32-35 kg/m3' },
        shippingProfile: {
          weightGrams: 2500,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 100 },
        },
      },
    ],
  },
  {
    title: {
      ar: 'ألواح عازل حراري العوازل العربية XPS',
      en: 'Awazel XPS Thermal Boards',
    },
    slug: 'awazel-xps-thermal-boards',
    description: {
      ar: 'ألواح عازل حراري عوازل العربية 5 سم ضغط 32-35.',
      en: 'Awazel extruded polystyrene thermal board 5 cm.',
    },
    brandSlug: 'awazel',
    categorySlug: 'thermal-acoustic-insulation',
    subCategorySlug: 'xps-insulation-boards',
    allowedAttributes: [
      { name: 'thickness', type: 'string', allowedValues: ['5 cm'] },
    ],
    variants: [
      {
        sku: '202300407',
        label: { ar: 'عوازل العربية XPS سماكة 5 سم', en: 'Awazel XPS 5 CM' },
        price: 28.5,
        stock: 400,
        attributes: { thickness: '5 cm' },
        shippingProfile: {
          weightGrams: 1250,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 50 },
        },
      },
    ],
  },
  {
    title: { ar: 'ألواح عازل حراري دلبا XPS', en: 'Dalba XPS Thermal Boards' },
    slug: 'dalba-xps-thermal-boards',
    description: {
      ar: 'ألواح عازل حراري دلبا مقاس 125×60 سم بسماكات متعددة.',
      en: 'Dalba XPS thermal insulation boards in various thicknesses.',
    },
    brandSlug: 'dalba',
    categorySlug: 'thermal-acoustic-insulation',
    subCategorySlug: 'xps-insulation-boards',
    allowedAttributes: [
      {
        name: 'thickness',
        type: 'string',
        allowedValues: [
          '3 cm',
          '4 cm',
          '5 cm',
          '6 cm',
          '7 cm',
          '7.5 cm',
          '8 cm',
          '9 cm',
          '10 cm',
        ],
      },
    ],
    variants: [
      {
        sku: '202306701',
        label: { ar: 'دلبا XPS سماكة 3 سم', en: 'Dalba XPS 03 CM' },
        price: 19,
        stock: 300,
        attributes: { thickness: '3 cm' },
        shippingProfile: {
          weightGrams: 850,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 30 },
        },
      },
      {
        sku: '202306702',
        label: { ar: 'دلبا XPS سماكة 4 سم', en: 'Dalba XPS 04 CM' },
        price: 23.5,
        stock: 350,
        attributes: { thickness: '4 cm' },
        shippingProfile: {
          weightGrams: 1000,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 40 },
        },
      },
      {
        sku: '202306703',
        label: { ar: 'دلبا XPS سماكة 5 سم', en: 'Dalba XPS 05 CM' },
        price: 28,
        stock: 500,
        attributes: { thickness: '5 cm' },
        shippingProfile: {
          weightGrams: 1250,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 50 },
        },
      },
      {
        sku: '202306704',
        label: { ar: 'دلبا XPS سماكة 6 سم', en: 'Dalba XPS 06 CM' },
        price: 33,
        stock: 200,
        attributes: { thickness: '6 cm' },
        shippingProfile: {
          weightGrams: 1500,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 60 },
        },
      },
      {
        sku: '202306709',
        label: { ar: 'دلبا XPS سماكة 10 سم', en: 'Dalba XPS 10 CM' },
        price: 52,
        stock: 150,
        attributes: { thickness: '10 cm' },
        shippingProfile: {
          weightGrams: 2500,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 100 },
        },
      },
    ],
  },
  {
    title: {
      ar: 'ألواح عازل حراري ريادة XPS',
      en: 'Riyada XPS Thermal Boards',
    },
    slug: 'riyada-xps-thermal-boards',
    description: {
      ar: 'ألواح عزل حراري ريادة ضغط 32-35 كغ/م3.',
      en: 'Riyada XPS thermal insulation boards.',
    },
    brandSlug: 'riyada',
    categorySlug: 'thermal-acoustic-insulation',
    subCategorySlug: 'xps-insulation-boards',
    allowedAttributes: [
      {
        name: 'thickness',
        type: 'string',
        allowedValues: ['3 cm', '4 cm', '5 cm', '10 cm'],
      },
    ],
    variants: [
      {
        sku: '202310001',
        label: { ar: 'ريادة XPS سماكة 3 سم', en: 'Riyada XPS 03 CM' },
        price: 19.5,
        stock: 300,
        attributes: { thickness: '3 cm' },
        shippingProfile: {
          weightGrams: 850,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 30 },
        },
      },
      {
        sku: '202310002',
        label: { ar: 'ريادة XPS سماكة 4 سم', en: 'Riyada XPS 04 CM' },
        price: 24,
        stock: 300,
        attributes: { thickness: '4 cm' },
        shippingProfile: {
          weightGrams: 1000,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 40 },
        },
      },
      {
        sku: '202310003',
        label: { ar: 'ريادة XPS سماكة 5 سم', en: 'Riyada XPS 05 CM' },
        price: 28.5,
        stock: 450,
        attributes: { thickness: '5 cm' },
        shippingProfile: {
          weightGrams: 1250,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 50 },
        },
      },
      {
        sku: '202310009',
        label: { ar: 'ريادة XPS سماكة 10 سم', en: 'Riyada XPS 10 CM' },
        price: 53,
        stock: 120,
        attributes: { thickness: '10 cm' },
        shippingProfile: {
          weightGrams: 2500,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1250, widthMm: 600, heightMm: 100 },
        },
      },
    ],
  },

  // ─── Geotextiles (Bonar Natpet, DADCO, Mattex, SKY TEX) ──────────────────────
  {
    title: {
      ar: 'ألياف جيوتكستايل بونار ناتبيت SNW',
      en: 'Bonar Natpet SNW Geotextiles',
    },
    slug: 'bonar-natpet-snw-geotextiles',
    description: {
      ar: 'لفائف جيوتكستايل غير منسوجة بولي بروبيلين عالية القوة لعزل وتثبيت التربة 3×100 متر.',
      en: 'Bonar Natpet non-woven polypropylene geotextile rolls for soil separation and filtration (3m x 100m).',
    },
    brandSlug: 'bonar-natpet',
    categorySlug: 'geotextiles-polyethylene',
    subCategorySlug: 'geotextiles',
    allowedAttributes: [
      {
        name: 'grammage',
        type: 'number',
        allowedValues: [
          '100',
          '120',
          '140',
          '150',
          '180',
          '200',
          '250',
          '300',
          '350',
        ],
        allowedUnits: ['gsm'],
      },
    ],
    variants: [
      {
        sku: '202300501',
        label: {
          ar: 'بونار ناتبيت 100 جرام (3*100 متر)',
          en: 'Bonar Natpet 100 GSM 3x100M',
        },
        price: 680,
        stock: 80,
        attributes: { grammage: { value: 100, unit: 'gsm' } },
        shippingProfile: {
          weightGrams: 30000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 3000, widthMm: 350, heightMm: 350 },
        },
      },
      {
        sku: '202300509',
        label: {
          ar: 'بونار ناتبيت 120 جرام (3*100 متر)',
          en: 'Bonar Natpet 120 GSM 3x100M',
        },
        price: 780,
        stock: 75,
        attributes: { grammage: { value: 120, unit: 'gsm' } },
        shippingProfile: {
          weightGrams: 36000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 3000, widthMm: 380, heightMm: 380 },
        },
      },
      {
        sku: '202300512',
        label: {
          ar: 'بونار ناتبيت 140 جرام (3*100 متر)',
          en: 'Bonar Natpet 140 GSM 3x100M',
        },
        price: 890,
        stock: 60,
        attributes: { grammage: { value: 140, unit: 'gsm' } },
        shippingProfile: {
          weightGrams: 42000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 3000, widthMm: 400, heightMm: 400 },
        },
      },
      {
        sku: '202300503',
        label: {
          ar: 'بونار ناتبيت 180 جرام (3*100 متر)',
          en: 'Bonar Natpet 180 GSM 3x100M',
        },
        price: 1100,
        stock: 50,
        attributes: { grammage: { value: 180, unit: 'gsm' } },
        shippingProfile: {
          weightGrams: 54000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 3000, widthMm: 450, heightMm: 450 },
        },
      },
      {
        sku: '202300508',
        label: {
          ar: 'بونار ناتبيت 200 جرام (3*100 متر)',
          en: 'Bonar Natpet 200 GSM 3x100M',
        },
        price: 1250,
        stock: 50,
        attributes: { grammage: { value: 200, unit: 'gsm' } },
        shippingProfile: {
          weightGrams: 60000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 3000, widthMm: 480, heightMm: 480 },
        },
      },
    ],
  },
  {
    title: { ar: 'ألياف جيوتكستايل دادكو تيكس', en: 'DADCO TEX Geotextiles' },
    slug: 'dadco-tex-geotextiles',
    description: {
      ar: 'ألياف جيوتكستايل دادكو عالية الجودة مقاس 3×100 متر بأوزان متنوعة.',
      en: 'DADCO TEX non-woven geotextile rolls 3x100M.',
    },
    brandSlug: 'dadco',
    categorySlug: 'geotextiles-polyethylene',
    subCategorySlug: 'geotextiles',
    allowedAttributes: [
      {
        name: 'grammage',
        type: 'number',
        allowedValues: ['80', '100', '120', '140', '180', '200', '300'],
        allowedUnits: ['gsm'],
      },
    ],
    variants: [
      {
        sku: '202301704',
        label: { ar: 'دادكو تيكس 100 جرام', en: 'DADCO TEX 100 GSM' },
        price: 650,
        stock: 90,
        attributes: { grammage: { value: 100, unit: 'gsm' } },
        shippingProfile: {
          weightGrams: 30000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 3000, widthMm: 350, heightMm: 350 },
        },
      },
      {
        sku: '202301705',
        label: { ar: 'دادكو تيكس 120 جرام', en: 'DADCO TEX 120 GSM' },
        price: 750,
        stock: 70,
        attributes: { grammage: { value: 120, unit: 'gsm' } },
        shippingProfile: {
          weightGrams: 36000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 3000, widthMm: 380, heightMm: 380 },
        },
      },
      {
        sku: '202301707',
        label: { ar: 'دادكو تيكس 180 جرام', en: 'DADCO TEX 180 GSM' },
        price: 1050,
        stock: 45,
        attributes: { grammage: { value: 180, unit: 'gsm' } },
        shippingProfile: {
          weightGrams: 54000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 3000, widthMm: 450, heightMm: 450 },
        },
      },
    ],
  },
  {
    title: { ar: 'ألياف جيوتكستايل سكاي تيكس', en: 'SKY TEX Geotextiles' },
    slug: 'sky-tex-geotextiles',
    description: {
      ar: 'لفائف جيوتكستايل سكاي تيكس غير المنسوجة مقاس 3×100 متر.',
      en: 'SKY TEX non-woven geotextile rolls 3x100M.',
    },
    brandSlug: 'sky-tex',
    categorySlug: 'geotextiles-polyethylene',
    subCategorySlug: 'geotextiles',
    allowedAttributes: [
      {
        name: 'grammage',
        type: 'number',
        allowedValues: [
          '60',
          '80',
          '90',
          '100',
          '120',
          '140',
          '180',
          '200',
          '300',
        ],
        allowedUnits: ['gsm'],
      },
    ],
    variants: [
      {
        sku: '202309303',
        label: { ar: 'سكاي تيكس 10 (100 جرام)', en: 'SKY TEX 10 (100 GSM)' },
        price: 640,
        stock: 120,
        attributes: { grammage: { value: 100, unit: 'gsm' } },
        shippingProfile: {
          weightGrams: 30000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 3000, widthMm: 350, heightMm: 350 },
        },
      },
      {
        sku: '202309305',
        label: { ar: 'سكاي تيكس 14 (140 جرام)', en: 'SKY TEX 14 (140 GSM)' },
        price: 840,
        stock: 90,
        attributes: { grammage: { value: 140, unit: 'gsm' } },
        shippingProfile: {
          weightGrams: 42000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 3000, widthMm: 400, heightMm: 400 },
        },
      },
      {
        sku: '202309307',
        label: { ar: 'سكاي تيكس 20 (200 جرام)', en: 'SKY TEX 20 (200 GSM)' },
        price: 1180,
        stock: 60,
        attributes: { grammage: { value: 200, unit: 'gsm' } },
        shippingProfile: {
          weightGrams: 60000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 3000, widthMm: 480, heightMm: 480 },
        },
      },
    ],
  },

  // ─── Bituminous Waterproofing Rolls (Dermabit, Gulf Seal, Henkel) ───────────
  {
    title: {
      ar: 'لفائف عزل مائي ديرمابيت 4170 بي بي اس 4 مم',
      en: 'Dermabit 4170 PBS Waterproofing Membranes 4MM',
    },
    slug: 'dermabit-4170-pbs-membranes',
    description: {
      ar: 'لفائف بيتومين معدل بالبوليمر عالية الأداء بسماكة 4 مم للعزل المائي للأسقف والأساسات.',
      en: 'Dermabit 4170 PBS polymer modified bituminous waterproofing membrane 4mm.',
    },
    brandSlug: 'dermabit',
    categorySlug: 'waterproofing-protection',
    subCategorySlug: 'bituminous-membranes',
    allowedAttributes: [
      {
        name: 'surface',
        type: 'string',
        allowedValues: [
          'سادة (Plain)',
          'بحص (Slated)',
          'جاردن حماية جذور (Garden)',
        ],
      },
    ],
    variants: [
      {
        sku: '202300701',
        label: {
          ar: 'ديرمابيت 4170 سادة 4 مم',
          en: 'Dermabit 4170 PBS Plain 4MM',
        },
        price: 165,
        stock: 250,
        attributes: { surface: 'سادة (Plain)' },
        shippingProfile: {
          weightGrams: 40000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 1000, widthMm: 220, heightMm: 220 },
        },
      },
      {
        sku: '202300707',
        label: {
          ar: 'ديرمابيت 4170 بحص 4 مم',
          en: 'Dermabit 4170 PBS Slated 4MM',
        },
        price: 185,
        stock: 200,
        attributes: { surface: 'بحص (Slated)' },
        shippingProfile: {
          weightGrams: 45000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 1000, widthMm: 230, heightMm: 230 },
        },
      },
      {
        sku: '202300710',
        label: {
          ar: 'ديرمابيت 4170 جاردن ضد الجذور 4 مم',
          en: 'Dermabit 4170 PBS Garden 4MM',
        },
        price: 215,
        stock: 120,
        attributes: { surface: 'جاردن حماية جذور (Garden)' },
        shippingProfile: {
          weightGrams: 42000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 1000, widthMm: 220, heightMm: 220 },
        },
      },
    ],
  },
  {
    title: {
      ar: 'لفائف عزل مائي عوازل الخليج إكسل',
      en: 'Gulf Seal GS Excell Waterproofing Membranes',
    },
    slug: 'gulf-seal-gs-excell-membranes',
    description: {
      ar: 'لفائف بيتومين عوازل الخليج فايبر جلاس وبوليستر 3 مم و 4 مم بحص وسادة.',
      en: 'Gulf Seal GS Excell bituminous waterproofing membranes.',
    },
    brandSlug: 'gulf-seal',
    categorySlug: 'waterproofing-protection',
    subCategorySlug: 'bituminous-membranes',
    allowedAttributes: [
      { name: 'thickness', type: 'string', allowedValues: ['3 mm', '4 mm'] },
      {
        name: 'finish',
        type: 'string',
        allowedValues: [
          'F (فيلم بوليستر)',
          'G (بحص)',
          'Green Anti Root (مقاوم جذور)',
        ],
      },
    ],
    variants: [
      {
        sku: '202301107',
        label: {
          ar: 'عوازل الخليج إكسل F سماكة 3 مم',
          en: 'Gulf Seal Excell F 3 MM',
        },
        price: 135,
        stock: 300,
        attributes: { thickness: '3 mm', finish: 'F (فيلم بوليستر)' },
        shippingProfile: {
          weightGrams: 35000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 1000, widthMm: 200, heightMm: 200 },
        },
      },
      {
        sku: '202301108',
        label: {
          ar: 'عوازل الخليج إكسل F سماكة 4 مم',
          en: 'Gulf Seal Excell F 4 MM',
        },
        price: 155,
        stock: 400,
        attributes: { thickness: '4 mm', finish: 'F (فيلم بوليستر)' },
        shippingProfile: {
          weightGrams: 42000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 1000, widthMm: 220, heightMm: 220 },
        },
      },
      {
        sku: '202301109',
        label: {
          ar: 'عوازل الخليج إكسل G بحص 4 مم',
          en: 'Gulf Seal Excell G 4 MM',
        },
        price: 175,
        stock: 250,
        attributes: { thickness: '4 mm', finish: 'G (بحص)' },
        shippingProfile: {
          weightGrams: 46000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 1000, widthMm: 230, heightMm: 230 },
        },
      },
      {
        sku: '202301110',
        label: {
          ar: 'عوازل الخليج إكسل جرين أنتي رووت 4 مم',
          en: 'Gulf Seal Excell Green Anti Root F 4 MM',
        },
        price: 210,
        stock: 150,
        attributes: {
          thickness: '4 mm',
          finish: 'Green Anti Root (مقاوم جذور)',
        },
        shippingProfile: {
          weightGrams: 43000,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 1000, widthMm: 220, heightMm: 220 },
        },
      },
    ],
  },

  // ─── Protection Boards (SKY Cartonal, Dermabit ArmoTect) ───────────────────
  {
    title: {
      ar: 'ألواح حماية بولي بروبيلين سكاي كارتونال',
      en: 'SKY Protection Cartonal Polypropylene Boards',
    },
    slug: 'sky-protection-cartonal-boards',
    description: {
      ar: 'ألواح حماية مضلعة زرقاء مقاس 2×1 متر لحماية العزل المائي والأرضيات والخرسانة.',
      en: 'Blue corrugated polypropylene protection boards (2m x 1m) for waterproofing and floor protection.',
    },
    brandSlug: 'sky-protection-cartonal',
    categorySlug: 'waterproofing-protection',
    subCategorySlug: 'protection-boards',
    allowedAttributes: [
      {
        name: 'thickness',
        type: 'string',
        allowedValues: ['3 mm', '4 mm', '5 mm', '6 mm'],
      },
      {
        name: 'densityGsm',
        type: 'number',
        allowedValues: ['350', '450', '600', '800'],
        allowedUnits: ['gsm'],
      },
    ],
    variants: [
      {
        sku: '202302001',
        label: {
          ar: 'سكاي كارتونال 3 مم (350 جرام)',
          en: 'SKY Cartonal 3MM (350 GSM)',
        },
        price: 12.5,
        stock: 800,
        attributes: {
          thickness: '3 mm',
          densityGsm: { value: 350, unit: 'gsm' },
        },
        shippingProfile: {
          weightGrams: 700,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 2000, widthMm: 1000, heightMm: 3 },
        },
      },
      {
        sku: '202302002',
        label: {
          ar: 'سكاي كارتونال 4 مم (450 جرام)',
          en: 'SKY Cartonal 4MM (450 GSM)',
        },
        price: 15.5,
        stock: 1200,
        attributes: {
          thickness: '4 mm',
          densityGsm: { value: 450, unit: 'gsm' },
        },
        shippingProfile: {
          weightGrams: 900,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 2000, widthMm: 1000, heightMm: 4 },
        },
      },
      {
        sku: '202302003',
        label: {
          ar: 'سكاي كارتونال 5 مم (600 جرام)',
          en: 'SKY Cartonal 5MM (600 GSM)',
        },
        price: 21,
        stock: 500,
        attributes: {
          thickness: '5 mm',
          densityGsm: { value: 600, unit: 'gsm' },
        },
        shippingProfile: {
          weightGrams: 1200,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 2000, widthMm: 1000, heightMm: 5 },
        },
      },
      {
        sku: '202302004',
        label: {
          ar: 'سكاي كارتونال 6 مم (800 جرام)',
          en: 'SKY Cartonal 6MM (800 GSM)',
        },
        price: 27,
        stock: 400,
        attributes: {
          thickness: '6 mm',
          densityGsm: { value: 800, unit: 'gsm' },
        },
        shippingProfile: {
          weightGrams: 1600,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 2000, widthMm: 1000, heightMm: 6 },
        },
      },
    ],
  },

  // ─── Polyethylene Sheets (SKY Sheet Polyethylene) ───────────────────────────
  {
    title: {
      ar: 'لفائف بلاستيك سكاي شيت بولي إيثيلين (25×4 متر)',
      en: 'SKY Polyethylene Plastic Sheets (25M x 4M)',
    },
    slug: 'sky-polyethylene-sheets-25x4m',
    description: {
      ar: 'لفائف نايلون بولي إيثيلين عالي الكثافة لعزل الرطوبة والصبات الخرسانية 100 متر مربع.',
      en: 'Heavy-duty polyethylene plastic vapor barrier sheets for concrete foundations (100 sqm).',
    },
    brandSlug: 'sky-sheet-polyethylene',
    categorySlug: 'geotextiles-polyethylene',
    subCategorySlug: 'polyethylene-sheets',
    allowedAttributes: [
      {
        name: 'micron',
        type: 'number',
        allowedValues: ['100', '150', '200', '250', '300', '400', '500'],
        allowedUnits: ['micron'],
      },
    ],
    variants: [
      {
        sku: '202305308',
        label: {
          ar: 'سكاي شيت 100 ميكرون (10.25 كغ)',
          en: 'SKY Sheet 100 Micron (10.25 KG)',
        },
        price: 95,
        stock: 200,
        attributes: { micron: { value: 100, unit: 'micron' } },
        shippingProfile: {
          weightGrams: 10250,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 1000, widthMm: 180, heightMm: 180 },
        },
      },
      {
        sku: '202305309',
        label: {
          ar: 'سكاي شيت 150 ميكرون (14.95 كغ)',
          en: 'SKY Sheet 150 Micron (14.95 KG)',
        },
        price: 135,
        stock: 180,
        attributes: { micron: { value: 150, unit: 'micron' } },
        shippingProfile: {
          weightGrams: 14950,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 1000, widthMm: 210, heightMm: 210 },
        },
      },
      {
        sku: '202305310',
        label: {
          ar: 'سكاي شيت 200 ميكرون (20.50 كغ)',
          en: 'SKY Sheet 200 Micron (20.50 KG)',
        },
        price: 180,
        stock: 220,
        attributes: { micron: { value: 200, unit: 'micron' } },
        shippingProfile: {
          weightGrams: 20500,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 1000, widthMm: 240, heightMm: 240 },
        },
      },
      {
        sku: '202305312',
        label: {
          ar: 'سكاي شيت 300 ميكرون (25.13 كغ)',
          en: 'SKY Sheet 300 Micron (25.13 KG)',
        },
        price: 235,
        stock: 150,
        attributes: { micron: { value: 300, unit: 'micron' } },
        shippingProfile: {
          weightGrams: 25130,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 1000, widthMm: 260, heightMm: 260 },
        },
      },
      {
        sku: '202305314',
        label: {
          ar: 'سكاي شيت 500 ميكرون (34.38 كغ)',
          en: 'SKY Sheet 500 Micron (34.38 KG)',
        },
        price: 320,
        stock: 100,
        attributes: { micron: { value: 500, unit: 'micron' } },
        shippingProfile: {
          weightGrams: 34380,
          packageType: PackageType.ROLL,
          dimensions: { lengthMm: 1000, widthMm: 300, heightMm: 300 },
        },
      },
    ],
  },

  // ─── Aluminum Flashings (SKY FLASHING) ──────────────────────────────────────
  {
    title: {
      ar: 'شرائح ألمنيوم فلاشينج 2.5 سم مبسط',
      en: 'SKY Flashing Aluminum 2.5 CM Flat Strips',
    },
    slug: 'sky-flashing-aluminum-2-5-cm-strips',
    description: {
      ar: 'شرائح ألمنيوم فلاشينج مبسطة عرض 2.5 سم طول 2.44 متر بسماكات متنوعة.',
      en: 'SKY Flashing aluminum flat strips 2.5cm width x 2.44M length.',
    },
    brandSlug: 'sky-flashing',
    categorySlug: 'flooring-expansion-joints',
    subCategorySlug: 'aluminum-flashings',
    allowedAttributes: [
      {
        name: 'thicknessMm',
        type: 'number',
        allowedValues: [
          '0.5',
          '0.6',
          '0.8',
          '1.0',
          '1.25',
          '1.5',
          '2.0',
          '3.0',
        ],
        allowedUnits: ['mm'],
      },
    ],
    variants: [
      {
        sku: '202305260',
        label: {
          ar: 'شريحة ألمنيوم 2.5 سم سماكة 0.5 ملم',
          en: 'Flashing Strip 2.5CM 0.5MM',
        },
        price: 8.5,
        stock: 300,
        attributes: { thicknessMm: { value: 0.5, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 165,
          packageType: PackageType.PIECE,
          dimensions: { lengthMm: 2440, widthMm: 25, heightMm: 1 },
        },
      },
      {
        sku: '202305255',
        label: {
          ar: 'شريحة ألمنيوم 2.5 سم سماكة 1.0 ملم',
          en: 'Flashing Strip 2.5CM 1.0MM',
        },
        price: 13.5,
        stock: 450,
        attributes: { thicknessMm: { value: 1.0, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 330,
          packageType: PackageType.PIECE,
          dimensions: { lengthMm: 2440, widthMm: 25, heightMm: 1 },
        },
      },
      {
        sku: '202305254',
        label: {
          ar: 'شريحة ألمنيوم 2.5 سم سماكة 2.0 ملم',
          en: 'Flashing Strip 2.5CM 2.0MM',
        },
        price: 24,
        stock: 250,
        attributes: { thicknessMm: { value: 2.0, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 660,
          packageType: PackageType.PIECE,
          dimensions: { lengthMm: 2440, widthMm: 25, heightMm: 2 },
        },
      },
    ],
  },
  {
    title: {
      ar: 'شرائح ألمنيوم فلاشينج 5 سم (طعجة واحدة 4+1)',
      en: 'SKY Flashing Aluminum 5 CM 1 Bend (4+1)',
    },
    slug: 'sky-flashing-aluminum-5-cm-1-bend',
    description: {
      ar: 'شرائح ألمنيوم فلاشينج 5 سم طعجة واحدة (4+1 سم) طول 2.44 متر.',
      en: 'SKY Flashing aluminum 5cm 1 bend (4+1) 2.44M length.',
    },
    brandSlug: 'sky-flashing',
    categorySlug: 'flooring-expansion-joints',
    subCategorySlug: 'aluminum-flashings',
    allowedAttributes: [
      {
        name: 'thicknessMm',
        type: 'number',
        allowedValues: ['0.6', '1.0', '1.25', '1.5'],
        allowedUnits: ['mm'],
      },
    ],
    variants: [
      {
        sku: '202305204',
        label: {
          ar: 'فلاشينج 5 سم (4+1) سماكة 0.6 ملم',
          en: 'Flashing 5CM (4+1) 0.6MM',
        },
        price: 15,
        stock: 350,
        attributes: { thicknessMm: { value: 0.6, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 395,
          packageType: PackageType.PIECE,
          dimensions: { lengthMm: 2440, widthMm: 50, heightMm: 10 },
        },
      },
      {
        sku: '202305239',
        label: {
          ar: 'فلاشينج 5 سم (4+1) سماكة 1.0 ملم',
          en: 'Flashing 5CM (4+1) 1.0MM',
        },
        price: 22,
        stock: 500,
        attributes: { thicknessMm: { value: 1.0, unit: 'mm' } },
        shippingProfile: {
          weightGrams: 660,
          packageType: PackageType.PIECE,
          dimensions: { lengthMm: 2440, widthMm: 50, heightMm: 10 },
        },
      },
    ],
  },

  // ─── Hordy Cork Insulation (Hordy Cork) ────────────────────────────────────
  {
    title: {
      ar: 'فلين هوردي بوليسترين عالي الكثافة مقاس 200×40×20 سم',
      en: 'Hordy Cork Blocks 200x40x20 CM',
    },
    slug: 'hordy-cork-blocks-200x40x20',
    description: {
      ar: 'قوالب فلين هوردي للأسقف المعلقة والهوردية عالية التحمل مقاس 200×40×20 سم بكثافات مختلفة.',
      en: 'Hordy polystyrene ceiling blocks 200x40x20cm.',
    },
    brandSlug: 'hordy-cork-brand',
    categorySlug: 'thermal-acoustic-insulation',
    subCategorySlug: 'hordy-cork',
    allowedAttributes: [
      {
        name: 'density',
        type: 'string',
        allowedValues: [
          'ضغط 8 عادي',
          'ضغط 10',
          'ضغط 12',
          'ضغط 14',
          'ضغط 16',
          'ضغط 18',
        ],
      },
    ],
    variants: [
      {
        sku: '202305101',
        label: {
          ar: 'فلين هوردي 200×40×20 ضغط 8 عادي',
          en: 'Hordy Cork 200x40x20 D08',
        },
        price: 22,
        stock: 300,
        attributes: { density: 'ضغط 8 عادي' },
        shippingProfile: {
          weightGrams: 1280,
          packageType: PackageType.PIECE,
          dimensions: { lengthMm: 2000, widthMm: 400, heightMm: 200 },
        },
      },
      {
        sku: '202305102',
        label: {
          ar: 'فلين هوردي 200×40×20 ضغط 10',
          en: 'Hordy Cork 200x40x20 D10',
        },
        price: 26,
        stock: 350,
        attributes: { density: 'ضغط 10' },
        shippingProfile: {
          weightGrams: 1600,
          packageType: PackageType.PIECE,
          dimensions: { lengthMm: 2000, widthMm: 400, heightMm: 200 },
        },
      },
      {
        sku: '202305103',
        label: {
          ar: 'فلين هوردي 200×40×20 ضغط 12',
          en: 'Hordy Cork 200x40x20 D12',
        },
        price: 31,
        stock: 250,
        attributes: { density: 'ضغط 12' },
        shippingProfile: {
          weightGrams: 1920,
          packageType: PackageType.PIECE,
          dimensions: { lengthMm: 2000, widthMm: 400, heightMm: 200 },
        },
      },
      {
        sku: '202305104',
        label: {
          ar: 'فلين هوردي 200×40×20 ضغط 14',
          en: 'Hordy Cork 200x40x20 D14',
        },
        price: 36,
        stock: 200,
        attributes: { density: 'ضغط 14' },
        shippingProfile: {
          weightGrams: 2240,
          packageType: PackageType.PIECE,
          dimensions: { lengthMm: 2000, widthMm: 400, heightMm: 200 },
        },
      },
    ],
  },

  // ─── Rockwool & Glasswool (Kimmco Isover) ───────────────────────────────────
  {
    title: {
      ar: 'ألواح صوف صخري كيمكو إيزوفر 120×60 سم',
      en: 'Kimmco Isover Rockwool Boards 120x60 CM',
    },
    slug: 'kimmco-isover-rockwool-boards-120x60',
    description: {
      ar: 'ألواح صوف صخري بركاني مقاوم للحريق وعازل حراري وصوتي ممتاز مقاس 120×60 سم.',
      en: 'Kimmco Isover non-combustible rockwool acoustic and thermal insulation boards.',
    },
    brandSlug: 'kimmco-isover',
    categorySlug: 'thermal-acoustic-insulation',
    subCategorySlug: 'rockwool-glasswool',
    allowedAttributes: [
      {
        name: 'thickness',
        type: 'string',
        allowedValues: ['4 cm', '5 cm', '10 cm'],
      },
      {
        name: 'density',
        type: 'number',
        allowedValues: ['40', '50', '70', '90', '100', '160'],
        allowedUnits: ['kg/m3'],
      },
    ],
    variants: [
      {
        sku: '202308301',
        label: {
          ar: 'صوف صخري 5 سم كثافة 40 كغ/م3',
          en: 'Rockwool 5 CM Density 40',
        },
        price: 38,
        stock: 180,
        attributes: {
          thickness: '5 cm',
          density: { value: 40, unit: 'kg/m3' },
        },
        shippingProfile: {
          weightGrams: 1440,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1200, widthMm: 600, heightMm: 50 },
        },
      },
      {
        sku: '2023002002',
        label: {
          ar: 'صوف صخري 5 سم كثافة 50 كغ/م3',
          en: 'Rockwool 5 CM Density 50',
        },
        price: 46,
        stock: 220,
        attributes: {
          thickness: '5 cm',
          density: { value: 50, unit: 'kg/m3' },
        },
        shippingProfile: {
          weightGrams: 1800,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1200, widthMm: 600, heightMm: 50 },
        },
      },
      {
        sku: '2023003040',
        label: {
          ar: 'صوف صخري 5 سم كثافة 100 كغ/م3',
          en: 'Rockwool 5 CM Density 100',
        },
        price: 78,
        stock: 140,
        attributes: {
          thickness: '5 cm',
          density: { value: 100, unit: 'kg/m3' },
        },
        shippingProfile: {
          weightGrams: 3600,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 1200, widthMm: 600, heightMm: 50 },
        },
      },
    ],
  },

  // ─── Polyurethane Raw Foam Drums (Polyurea, DOW, Galaxy, Sika) ─────────────
  {
    title: {
      ar: 'خامات فوم بولي يوريثان لرش الأسطح (إيزوسيانات وبوليول)',
      en: 'Polyurethane Spray Foam Raw Chemicals (ISO & Polyol)',
    },
    slug: 'polyurethane-spray-foam-chemicals-drums',
    description: {
      ar: 'براميل مواد خام لعزل الفوم الإيزوسيانات 250 كغ والبوليول 220 كغ لرش أسطح المباني.',
      en: 'Industrial spray foam chemical components (MDI Isocyanate & Polyol blend drums).',
    },
    brandSlug: 'dow',
    categorySlug: 'construction-chemicals-repair',
    subCategorySlug: 'foam-raw-chemicals',
    allowedAttributes: [
      {
        name: 'componentType',
        type: 'string',
        allowedValues: ['Isocyanate MDI (أحمر)', 'Polyol Blend (أزرق)'],
      },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['210', '220', '250'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202302601',
        label: {
          ar: 'داو بولي يوريثان إيزوسيانات أحمر 250 كغ',
          en: 'DOW MDI Polyurethane Red ISO 250 KG',
        },
        price: 2850,
        stock: 40,
        attributes: {
          componentType: 'Isocyanate MDI (أحمر)',
          weight: { value: 250, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 250000,
          packageType: PackageType.DRUM,
          dimensions: { lengthMm: 585, widthMm: 585, heightMm: 880 },
        },
      },
      {
        sku: '202302602',
        label: {
          ar: 'داو بولي يوريثان بوليول أزرق 210 كغ',
          en: 'DOW Polyol Blend Blue 210 KG',
        },
        price: 2650,
        stock: 45,
        attributes: {
          componentType: 'Polyol Blend (أزرق)',
          weight: { value: 210, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 210000,
          packageType: PackageType.DRUM,
          dimensions: { lengthMm: 585, widthMm: 585, heightMm: 880 },
        },
      },
      {
        sku: '202306101',
        label: {
          ar: 'جلاكسي MDI أحمر إيزو 250 كغ',
          en: 'Galaxy MDI ISO Red 250 KG',
        },
        price: 2750,
        stock: 35,
        attributes: {
          componentType: 'Isocyanate MDI (أحمر)',
          weight: { value: 250, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 250000,
          packageType: PackageType.DRUM,
          dimensions: { lengthMm: 585, widthMm: 585, heightMm: 880 },
        },
      },
      {
        sku: '202306102',
        label: {
          ar: 'جلاكسي بوليول بلند أزرق 220 كغ',
          en: 'Galaxy Polyol Blend Blue 220 KG',
        },
        price: 2550,
        stock: 40,
        attributes: {
          componentType: 'Polyol Blend (أزرق)',
          weight: { value: 220, unit: 'kg' },
        },
        shippingProfile: {
          weightGrams: 220000,
          packageType: PackageType.DRUM,
          dimensions: { lengthMm: 585, widthMm: 585, heightMm: 880 },
        },
      },
    ],
  },

  // ─── Epoxies & Tank Coatings (Sika, Fosroc, CIC, Silver) ─────────────────────
  {
    title: {
      ar: 'دهان إيبوكسي أرضيات سيكا فلور 264',
      en: 'Sika Floor 264 Epoxy Floor Coating',
    },
    slug: 'sika-floor-264-epoxy-coating',
    description: {
      ar: 'نظام طلاء إيبوكسي ملون ذاتي التسوية للأرضيات الصناعية والتجارية (A+B) 25 كغ بألوان رال متعددة.',
      en: 'Sika Floor 264 2-part colored epoxy coating for concrete floors.',
    },
    brandSlug: 'sika',
    categorySlug: 'flooring-expansion-joints',
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      {
        name: 'color',
        type: 'string',
        allowedValues: [
          'RAL 7035 Light Grey',
          'RAL 7037 Dusty Grey',
          'RAL 7040 Dolphin Grey',
          'RAL 3000 Red',
        ],
      },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['24', '25'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202300632',
        label: {
          ar: 'سيكا فلور 264 رمادي فاتح RAL 7035 (24 كغ)',
          en: 'Sika Floor 264 RAL 7035 24KG',
        },
        price: 490,
        stock: 60,
        attributes: {
          color: 'RAL 7035 Light Grey',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: { weightGrams: 24000, packageType: PackageType.DRUM },
        components: [
          { name: 'A', value: 19, unit: 'kg' },
          { name: 'B', value: 5, unit: 'kg' },
        ],
      },
      {
        sku: '202300637',
        label: {
          ar: 'سيكا فلور 264 رمادي RAL 7037 (24 كغ)',
          en: 'Sika Floor 264 RAL 7037 24KG',
        },
        price: 490,
        stock: 50,
        attributes: {
          color: 'RAL 7037 Dusty Grey',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: { weightGrams: 24000, packageType: PackageType.DRUM },
        components: [
          { name: 'A', value: 19, unit: 'kg' },
          { name: 'B', value: 5, unit: 'kg' },
        ],
      },
      {
        sku: '202300604',
        label: {
          ar: 'سيكا فلور 264 رمادي دولفين RAL 7040 (24 كغ)',
          en: 'Sika Floor 264 RAL 7040 24KG',
        },
        price: 490,
        stock: 70,
        attributes: {
          color: 'RAL 7040 Dolphin Grey',
          weight: { value: 24, unit: 'kg' },
        },
        shippingProfile: { weightGrams: 24000, packageType: PackageType.DRUM },
        components: [
          { name: 'A', value: 19, unit: 'kg' },
          { name: 'B', value: 5, unit: 'kg' },
        ],
      },
    ],
  },
  {
    title: {
      ar: 'عازل خزانات إيبوكسي سي اي سي سيكو كوت HB',
      en: 'CIC Cico Coat HB Epoxy Tank Coating',
    },
    slug: 'cic-cico-coat-hb-epoxy-tank',
    description: {
      ar: 'طلاء إيبوكسي عالي السماكة معتمد لعزل خزانات مياه الشرب وخزانات الصرف (مركبين A+B).',
      en: 'CIC Cico Coat HB high-build epoxy coating for water tanks.',
    },
    brandSlug: 'cic',
    categorySlug: 'flooring-expansion-joints',
    subCategorySlug: 'epoxy-flooring-tanks',
    allowedAttributes: [
      {
        name: 'color',
        type: 'string',
        allowedValues: ['Blue (أزرق)', 'Grey (رمادي)'],
      },
      {
        name: 'weight',
        type: 'number',
        allowedValues: ['5', '15', '28'],
        allowedUnits: ['kg'],
      },
    ],
    variants: [
      {
        sku: '202303834',
        label: {
          ar: 'سيكو كوت HB أزرق 5 كغ (A+B)',
          en: 'CIC Cico Coat HB Blue 5KG',
        },
        price: 185,
        stock: 80,
        attributes: { color: 'Blue (أزرق)', weight: { value: 5, unit: 'kg' } },
        shippingProfile: { weightGrams: 5000, packageType: PackageType.GALLON },
        components: [
          { name: 'A', value: 4, unit: 'kg' },
          { name: 'B', value: 1, unit: 'kg' },
        ],
      },
      {
        sku: '202303827',
        label: {
          ar: 'سيكو كوت HB أزرق 15 كغ (A+B)',
          en: 'CIC Cico Coat HB Blue 15KG',
        },
        price: 480,
        stock: 65,
        attributes: { color: 'Blue (أزرق)', weight: { value: 15, unit: 'kg' } },
        shippingProfile: { weightGrams: 15000, packageType: PackageType.DRUM },
        components: [
          { name: 'A', value: 12, unit: 'kg' },
          { name: 'B', value: 3, unit: 'kg' },
        ],
      },
      {
        sku: '202303849',
        label: {
          ar: 'سيكو كوت HB أزرق 28 كغ (A+B)',
          en: 'CIC Cico Coat HB Blue 28KG',
        },
        price: 790,
        stock: 40,
        attributes: { color: 'Blue (أزرق)', weight: { value: 28, unit: 'kg' } },
        shippingProfile: { weightGrams: 28000, packageType: PackageType.DRUM },
        components: [
          { name: 'A', value: 22.4, unit: 'kg' },
          { name: 'B', value: 5.6, unit: 'kg' },
        ],
      },
    ],
  },

  // ─── Power Tools & Hardware (Bosch, Wood, Accessories) ──────────────────────
  {
    title: {
      ar: 'معدات وأدوات بوش الكهربائية للمقاولات',
      en: 'Bosch Professional Power Tools',
    },
    slug: 'bosch-professional-power-tools',
    description: {
      ar: 'معدات بوش الألمانية الأصلية الاحترافية لأعمال البناء والتشييد والقص والتخريم.',
      en: 'Genuine Bosch power tools for construction, drilling and cutting.',
    },
    brandSlug: 'wood-timber',
    categorySlug: 'tools-hardware-supplies',
    subCategorySlug: 'power-tools',
    allowedAttributes: [
      {
        name: 'toolType',
        type: 'string',
        allowedValues: [
          'دريل 600W 13mm',
          'صاروخ 9 بوصة',
          'منشار خشب 9 بوصة',
          'منفاخ هواء 650W',
          'هيلتي همر 720W 20mm',
        ],
      },
    ],
    variants: [
      {
        sku: '202312241',
        label: {
          ar: 'بوش دريل كهربائي 600 واط 13 مم',
          en: 'Bosch Electric Drill 600W 13MM',
        },
        price: 290,
        stock: 30,
        attributes: { toolType: 'دريل 600W 13mm' },
        shippingProfile: {
          weightGrams: 2200,
          packageType: PackageType.BOX,
          dimensions: { lengthMm: 300, widthMm: 260, heightMm: 90 },
        },
      },
      {
        sku: '202312217',
        label: {
          ar: 'بوش صاروخ قص وتجليخ 9 بوصة',
          en: 'Bosch Angle Grinder 9 Inch',
        },
        price: 680,
        stock: 25,
        attributes: { toolType: 'صاروخ 9 بوصة' },
        shippingProfile: {
          weightGrams: 5100,
          packageType: PackageType.BOX,
          dimensions: { lengthMm: 500, widthMm: 200, heightMm: 140 },
        },
      },
      {
        sku: '202312218',
        label: {
          ar: 'بوش منشار دائري للخشب 9 بوصة',
          en: 'Bosch Circular Wood Saw 9 Inch',
        },
        price: 750,
        stock: 20,
        attributes: { toolType: 'منشار خشب 9 بوصة' },
        shippingProfile: {
          weightGrams: 6400,
          packageType: PackageType.BOX,
          dimensions: { lengthMm: 480, widthMm: 320, heightMm: 280 },
        },
      },
      {
        sku: '202312242',
        label: {
          ar: 'بوش منفاخ هواء احترافي 650 واط',
          en: 'Bosch Air Blower 650W',
        },
        price: 340,
        stock: 35,
        attributes: { toolType: 'منفاخ هواء 650W' },
        shippingProfile: {
          weightGrams: 2000,
          packageType: PackageType.BOX,
          dimensions: { lengthMm: 330, widthMm: 220, heightMm: 190 },
        },
      },
      {
        sku: '202312245',
        label: {
          ar: 'بوش همر هيلتي تكسير وتخريم 20 مم 720 واط',
          en: 'Bosch Rotary Hammer Hilti 20MM 720W',
        },
        price: 580,
        stock: 25,
        attributes: { toolType: 'هيلتي همر 720W 20mm' },
        shippingProfile: {
          weightGrams: 3200,
          packageType: PackageType.BOX,
          dimensions: { lengthMm: 390, widthMm: 280, heightMm: 110 },
        },
      },
    ],
  },
  {
    title: {
      ar: 'ألواح خشب بليوود إندونيسي وبرازيلية للخرسانة',
      en: 'Construction Plywood Shuttering Boards',
    },
    slug: 'construction-plywood-shuttering-boards',
    description: {
      ar: 'ألواح بليوود عالية الجودة للشدات الخرسانية مقاس 122×244 سم سماكة 18 مم.',
      en: 'High-quality film-faced shuttering plywood boards 122x244cm 18mm.',
    },
    brandSlug: 'wood-timber',
    categorySlug: 'tools-hardware-supplies',
    subCategorySlug: 'timber-plywood',
    allowedAttributes: [
      {
        name: 'origin',
        type: 'string',
        allowedValues: [
          'إندونيسي (Indonesian)',
          'سوميك (Sumec)',
          'ماك بليكس (Makplex)',
          'ايمبا وود أخضر (Empa Wood)',
        ],
      },
    ],
    variants: [
      {
        sku: '202300104',
        label: {
          ar: 'سوميك لوح بليوود 122×244 سم 18 مم',
          en: 'Sumec Plywood Board 122x244cm 18mm',
        },
        price: 135,
        stock: 250,
        attributes: { origin: 'سوميك (Sumec)' },
        shippingProfile: {
          weightGrams: 32000,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 2440, widthMm: 1220, heightMm: 18 },
        },
      },
      {
        sku: '202312223',
        label: {
          ar: 'كوريندو سمارت بليكس إندونيسي 122×244 سم 18 مم',
          en: 'Korindo Smart Plex Indonesian 122x244cm 18mm',
        },
        price: 155,
        stock: 300,
        attributes: { origin: 'إندونيسي (Indonesian)' },
        shippingProfile: {
          weightGrams: 34000,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 2440, widthMm: 1220, heightMm: 18 },
        },
      },
      {
        sku: '202312229',
        label: {
          ar: 'ماك بليكس لوح بليوود 122×244 سم 18 مم',
          en: 'Makplex Plywood Board 122x244cm 18mm',
        },
        price: 140,
        stock: 200,
        attributes: { origin: 'ماك بليكس (Makplex)' },
        shippingProfile: {
          weightGrams: 33000,
          packageType: PackageType.BOARD,
          dimensions: { lengthMm: 2440, widthMm: 1220, heightMm: 18 },
        },
      },
    ],
  },
];
