export interface PermissionMetadata {
  key: Permissions;
  label: string;
  group: string;
}
export enum Permissions {
  // ---- Dashboard Access ----
  ACCESS_DASHBOARD = 'access_dashboard',
  VIEW_DASHBOARD_STATS = 'view_dashboard_stats',

  // ---- Settings ----
  VIEW_SETTINGS = 'view_settings',
  UPDATE_SETTINGS = 'update_settings',
  // ---- Locations ----
  VIEW_LOCATIONS = 'view_locations',
  CREATE_LOCATION = 'create_location',
  UPDATE_LOCATION = 'update_location',
  DELETE_LOCATION = 'delete_location',
  // ---- External Platforms ----
  VIEW_EXTERNAL_PLATFORMS = 'view_external-platforms',

  // ---- Roles & Permissions ----
  VIEW_ROLES = 'view_roles',
  CREATE_ROLE = 'create_role',
  UPDATE_ROLE = 'update_role',
  DELETE_ROLE = 'delete_role',

  // ---- Users ----
  VIEW_USERS = 'view_users',
  CREATE_USER = 'create_user',
  UPDATE_USER = 'update_user',
  DELETE_USER = 'delete_user',

  // ---- Suppliers ----
  VIEW_SUPPLIERS = 'view_suppliers',
  CREATE_SUPPLIER = 'create_supplier',
  UPDATE_SUPPLIER = 'update_supplier',
  DELETE_SUPPLIER = 'delete_supplier',

  // ---- Products ----
  VIEW_PRODUCTS = 'view_products',
  CREATE_PRODUCT = 'create_product',
  UPDATE_PRODUCT = 'update_product',
  DELETE_PRODUCT = 'delete_product',
  VIEW_PRODUCTS_STATS = 'view_products_stats',

  // ---- Orders ----
  VIEW_ORDERS = 'view_orders',
  UPDATE_ORDER_STATUS = 'update_order_status',
  DELETE_ORDER = 'delete_order',
  REFUND_ORDER = 'refund_order',

  // ---- Categories ----
  VIEW_CATEGORIES = 'view_categories',
  CREATE_CATEGORY = 'create_category',
  UPDATE_CATEGORY = 'update_category',
  DELETE_CATEGORY = 'delete_category',

  // ---- Sub Categories ----
  VIEW_SUB_CATEGORIES = 'view_sub_categories',
  CREATE_SUB_CATEGORY = 'create_sub_category',
  UPDATE_SUB_CATEGORY = 'update_sub_category',
  DELETE_SUB_CATEGORY = 'delete_sub_category',

  // ---- Brands ----
  VIEW_BRANDS = 'view_brands',
  CREATE_BRAND = 'create_brand',
  UPDATE_BRAND = 'update_brand',
  DELETE_BRAND = 'delete_brand',

  // ---- Carousels ----
  VIEW_CAROUSEL = 'view_carousels',
  CREATE_CAROUSEL = 'create_carousel',
  UPDATE_CAROUSEL = 'update_carousel',
  DELETE_CAROUSEL = 'delete_carousel',

  // ---- Coupons & Promo ----
  VIEW_COUPONS = 'view_coupons',
  CREATE_COUPON = 'create_coupon',
  UPDATE_COUPON = 'update_coupon',
  DELETE_COUPON = 'delete_coupon',
  // ---- Promo Banners ----
  VIEW_PROMO_BANNERS = 'view_promo_banners',
  CREATE_PROMO_BANNER = 'create_promo_banner',
  UPDATE_PROMO_BANNER = 'update_promo_banner',
  DELETE_PROMO_BANNER = 'delete_promo_banner',

  // ---- Shipping & Taxes ----
  VIEW_SHIPPING = 'view_shipping',
  CREATE_SHIPPING = 'create_shipping',
  UPDATE_SHIPPING = 'update_shipping',
  DELETE_SHIPPING = 'delete_shipping',
  VIEW_SHIPPING_RATES = 'view_shipping_rates',

  VIEW_TAXES = 'view_taxes',
  CREATE_TAX = 'create_tax',
  UPDATE_TAX = 'update_tax',
  DELETE_TAX = 'delete_tax',
  // ---- Notifications ----
  VIEW_NOTIFICATIONS = 'view_notifications',
  SEND_NOTIFICATION = 'send_notification',
  DELETE_NOTIFICATION = 'delete_notification',
}

export const PERMISSIONS_METADATA: PermissionMetadata[] = [
  // Dashboard
  {
    key: Permissions.ACCESS_DASHBOARD,
    group: 'لوحة التحكم',
    label: 'دخول لوحة التحكم',
  },
  {
    key: Permissions.VIEW_DASHBOARD_STATS,
    group: 'لوحة التحكم',
    label: 'عرض إحصائيات لوحة التحكم',
  },

  // Settings
  {
    key: Permissions.VIEW_SETTINGS,
    group: 'الإعدادات',
    label: 'عرض إعدادات النظام',
  },
  {
    key: Permissions.UPDATE_SETTINGS,
    group: 'الإعدادات',
    label: 'تعديل إعدادات النظام',
  },

  {
    key: Permissions.VIEW_LOCATIONS,
    group: 'الإعدادات',
    label: 'عرض المواقع والفروع',
  },
  {
    key: Permissions.CREATE_LOCATION,
    group: 'الإعدادات',
    label: 'إضافة موقع/فرع',
  },
  {
    key: Permissions.UPDATE_LOCATION,
    group: 'الإعدادات',
    label: 'تعديل موقع/فرع',
  },
  {
    key: Permissions.DELETE_LOCATION,
    group: 'الإعدادات',
    label: 'حذف موقع/فرع',
  },

  {
    key: Permissions.VIEW_EXTERNAL_PLATFORMS,
    group: 'الإعدادات',
    label: 'عرض المنصات الخارجية',
  },
  // Roles & Permissions
  {
    key: Permissions.VIEW_ROLES,
    group: 'الأدوار والصلاحيات',
    label: 'عرض الأدوار',
  },
  {
    key: Permissions.CREATE_ROLE,
    group: 'الأدوار والصلاحيات',
    label: 'إضافة دور',
  },
  {
    key: Permissions.UPDATE_ROLE,
    group: 'الأدوار والصلاحيات',
    label: 'تعديل دور',
  },
  {
    key: Permissions.DELETE_ROLE,
    group: 'الأدوار والصلاحيات',
    label: 'حذف دور',
  },

  // Users & Suppliers
  {
    key: Permissions.VIEW_USERS,
    group: 'المستخدمون',
    label: 'عرض المستخدمين',
  },
  {
    key: Permissions.CREATE_USER,
    group: 'المستخدمون',
    label: 'إضافة مستخدم',
  },
  {
    key: Permissions.UPDATE_USER,
    group: 'المستخدمون',
    label: 'تعديل مستخدم',
  },
  {
    key: Permissions.DELETE_USER,
    group: 'المستخدمون',
    label: 'حذف مستخدم',
  },

  {
    key: Permissions.VIEW_SUPPLIERS,
    group: 'الموردون',
    label: 'عرض الموردين',
  },
  {
    key: Permissions.CREATE_SUPPLIER,
    group: 'الموردون',
    label: 'إضافة مورد',
  },
  {
    key: Permissions.UPDATE_SUPPLIER,
    group: 'الموردون',
    label: 'تعديل مورد',
  },
  {
    key: Permissions.DELETE_SUPPLIER,
    group: 'الموردون',
    label: 'حذف مورد',
  },

  // Products
  {
    key: Permissions.VIEW_PRODUCTS,
    group: 'المنتجات',
    label: 'عرض المنتجات',
  },
  {
    key: Permissions.VIEW_PRODUCTS_STATS,
    group: 'المنتجات',
    label: 'عرض إحصائيات المنتجات',
  },
  {
    key: Permissions.CREATE_PRODUCT,
    group: 'المنتجات',
    label: 'إضافة منتج',
  },
  {
    key: Permissions.UPDATE_PRODUCT,
    group: 'المنتجات',
    label: 'تعديل منتج',
  },
  {
    key: Permissions.DELETE_PRODUCT,
    group: 'المنتجات',
    label: 'حذف منتج',
  },

  // Orders
  {
    key: Permissions.VIEW_ORDERS,
    group: 'الطلبات',
    label: 'عرض الطلبات',
  },
  {
    key: Permissions.UPDATE_ORDER_STATUS,
    group: 'الطلبات',
    label: 'تحديث حالة الطلب',
  },
  {
    key: Permissions.DELETE_ORDER,
    group: 'الطلبات',
    label: 'حذف طلب',
  },
  {
    key: Permissions.REFUND_ORDER,
    group: 'الطلبات',
    label: 'استرداد طلب',
  },

  // Categories
  {
    key: Permissions.VIEW_CATEGORIES,
    group: 'الفئات والأقسام',
    label: 'عرض الفئات',
  },
  {
    key: Permissions.CREATE_CATEGORY,
    group: 'الفئات والأقسام',
    label: 'إضافة فئة',
  },
  {
    key: Permissions.UPDATE_CATEGORY,
    group: 'الفئات والأقسام',
    label: 'تعديل فئة',
  },
  {
    key: Permissions.DELETE_CATEGORY,
    group: 'الفئات والأقسام',
    label: 'حذف فئة',
  },

  // Sub Categories
  {
    key: Permissions.VIEW_SUB_CATEGORIES,
    group: 'الفئات والأقسام',
    label: 'عرض الأقسام الفرعية',
  },
  {
    key: Permissions.CREATE_SUB_CATEGORY,
    group: 'الفئات والأقسام',
    label: 'إضافة قسم فرعي',
  },
  {
    key: Permissions.UPDATE_SUB_CATEGORY,
    group: 'الفئات والأقسام',
    label: 'تعديل قسم فرعي',
  },
  {
    key: Permissions.DELETE_SUB_CATEGORY,
    group: 'الفئات والأقسام',
    label: 'حذف قسم فرعي',
  },

  // Brands
  {
    key: Permissions.VIEW_BRANDS,
    group: 'العلامات التجارية',
    label: 'عرض العلامات التجارية',
  },
  {
    key: Permissions.CREATE_BRAND,
    group: 'العلامات التجارية',
    label: 'إضافة علامة تجارية',
  },
  {
    key: Permissions.UPDATE_BRAND,
    group: 'العلامات التجارية',
    label: 'تعديل علامة تجارية',
  },
  {
    key: Permissions.DELETE_BRAND,
    group: 'العلامات التجارية',
    label: 'حذف علامة تجارية',
  },

  // Carousels
  {
    key: Permissions.VIEW_CAROUSEL,
    group: 'العروض المرئية',
    label: 'عرض شريط العروض (Carousel)',
  },
  {
    key: Permissions.CREATE_CAROUSEL,
    group: 'العروض المرئية',
    label: 'إضافة عرض مرئي',
  },
  {
    key: Permissions.UPDATE_CAROUSEL,
    group: 'العروض المرئية',
    label: 'تعديل عرض مرئي',
  },
  {
    key: Permissions.DELETE_CAROUSEL,
    group: 'العروض المرئية',
    label: 'حذف عرض مرئي',
  },

  // Coupons & Promo
  {
    key: Permissions.VIEW_COUPONS,
    group: 'الكوبونات والعروض',
    label: 'عرض الكوبونات',
  },
  {
    key: Permissions.CREATE_COUPON,
    group: 'الكوبونات والعروض',
    label: 'إضافة كوبون',
  },
  {
    key: Permissions.UPDATE_COUPON,
    group: 'الكوبونات والعروض',
    label: 'تعديل كوبون',
  },
  {
    key: Permissions.DELETE_COUPON,
    group: 'الكوبونات والعروض',
    label: 'حذف كوبون',
  },

  {
    key: Permissions.VIEW_PROMO_BANNERS,
    group: 'الكوبونات والعروض',
    label: 'عرض البنرات الإعلانية',
  },
  {
    key: Permissions.CREATE_PROMO_BANNER,
    group: 'الكوبونات والعروض',
    label: 'إضافة بنر إعلاني',
  },
  {
    key: Permissions.UPDATE_PROMO_BANNER,
    group: 'الكوبونات والعروض',
    label: 'تعديل بنر إعلاني',
  },
  {
    key: Permissions.DELETE_PROMO_BANNER,
    group: 'الكوبونات والعروض',
    label: 'حذف بنر إعلاني',
  },

  // Shipping & Taxes
  {
    key: Permissions.VIEW_SHIPPING,
    group: 'الشحن والضرائب',
    label: 'عرض إعدادات الشحن',
  },
  {
    key: Permissions.CREATE_SHIPPING,
    group: 'الشحن والضرائب',
    label: 'إضافة إعداد شحن',
  },
  {
    key: Permissions.UPDATE_SHIPPING,
    group: 'الشحن والضرائب',
    label: 'تعديل إعداد شحن',
  },
  {
    key: Permissions.DELETE_SHIPPING,
    group: 'الشحن والضرائب',
    label: 'حذف إعداد شحن',
  },
  {
    key: Permissions.VIEW_SHIPPING_RATES,
    group: 'الشحن والضرائب',
    label: 'عرض أسعار الشحن',
  },

  {
    key: Permissions.VIEW_TAXES,
    group: 'الشحن والضرائب',
    label: 'عرض الضرائب',
  },
  {
    key: Permissions.CREATE_TAX,
    group: 'الشحن والضرائب',
    label: 'إضافة ضريبة',
  },
  {
    key: Permissions.UPDATE_TAX,
    group: 'الشحن والضرائب',
    label: 'تعديل ضريبة',
  },
  {
    key: Permissions.DELETE_TAX,
    group: 'الشحن والضرائب',
    label: 'حذف ضريبة',
  },

  // Notifications
  {
    key: Permissions.VIEW_NOTIFICATIONS,
    group: 'الإشعارات',
    label: 'عرض الإشعارات',
  },
  {
    key: Permissions.SEND_NOTIFICATION,
    group: 'الإشعارات',
    label: 'إضافة إشعار',
  },
  {
    key: Permissions.DELETE_NOTIFICATION,
    group: 'الإشعارات',
    label: 'حذف إشعار',
  },
];
