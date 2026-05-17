export interface PermissionMetadata {
  key: Permissions;
  label: string;
  group: string;
}
export enum Permissions {
  // ---- Dashboard Access ----
  ACCESS_DASHBOARD = 'access_dashboard',
  // ---- Settings ----
  MANAGE_SETTINGS = 'manage_settings',
  // ---- Roles & Permissions ----
  MANAGE_ROLES = 'manage_roles',
  VIEW_ROLES = 'view_roles',
  // ---- Users ----
  MANAGE_USERS = 'manage_users',
  VIEW_USERS = 'view_users',
  // ---- Products ----
  CREATE_PRODUCT = 'create_product',
  UPDATE_PRODUCT = 'update_product',
  DELETE_PRODUCT = 'delete_product',
  VIEW_PRODUCTS = 'view_products',
  // ---- Orders ----
  UPDATE_ORDER_STATUS = 'update_order_status',
  DELETE_ORDER = 'delete_order',
  VIEW_ORDERS = 'view_orders',
  REFUND_ORDER = 'refund_order',
  // ---- Categories ----
  MANAGE_CATEGORIES = 'manage_categories',
  VIEW_CATEGORIES = 'view_categories',
  // ---- Sub Categories ----
  MANAGE_SUB_CATEGORIES = 'manage_sub_categories',
  VIEW_SUB_CATEGORIES = 'view_sub_categories',
  // ---- Brands ----
  MANAGE_BRANDS = 'manage_brands',
  VIEW_BRANDS = 'view_brands',
  // ---- Carousels ----
  MANAGE_CAROUSEL = 'manage_carousels',
  VIEW_CAROUSEL = 'view_carousels',
  // ---- Coupons & Promo ----
  MANAGE_COUPONS = 'manage_coupons',
  MANAGE_PROMO_BANNERS = 'manage_promo_banners',
  VIEW_PROMO_BANNERS = 'view_promo_banners',
  // ---- Shipping & Taxes ----
  MANAGE_SHIPPING = 'manage_shipping',
  VIEW_SHIPPING = 'view_shipping',
  MANAGE_TAXES = 'manage_taxes',
}

export const PERMISSIONS_METADATA: PermissionMetadata[] = [
  {
    key: Permissions.ACCESS_DASHBOARD,
    group: 'لوحة التحكم',
    label: 'دخول لوحة التحكم',
  },
  {
    key: Permissions.MANAGE_SETTINGS,
    group: 'الإعدادات',
    label: 'إدارة إعدادات النظام',
  },
  {
    key: Permissions.VIEW_ROLES,
    group: 'الأدوار والصلاحيات',
    label: 'عرض الأدوار',
  },
  {
    key: Permissions.MANAGE_ROLES,
    group: 'الأدوار والصلاحيات',
    label: 'إدارة الأدوار',
  },
  { key: Permissions.VIEW_USERS, group: 'المستخدمون', label: 'عرض المستخدمين' },
  {
    key: Permissions.MANAGE_USERS,
    group: 'المستخدمون',
    label: 'إدارة المستخدمين',
  },
  { key: Permissions.VIEW_PRODUCTS, group: 'المنتجات', label: 'عرض المنتجات' },
  { key: Permissions.CREATE_PRODUCT, group: 'المنتجات', label: 'إضافة منتج' },
  { key: Permissions.UPDATE_PRODUCT, group: 'المنتجات', label: 'تعديل منتج' },
  { key: Permissions.DELETE_PRODUCT, group: 'المنتجات', label: 'حذف منتج' },
  { key: Permissions.VIEW_ORDERS, group: 'الطلبات', label: 'عرض الطلبات' },
  {
    key: Permissions.UPDATE_ORDER_STATUS,
    group: 'الطلبات',
    label: 'تحديث حالة الطلب',
  },
  { key: Permissions.DELETE_ORDER, group: 'الطلبات', label: 'حذف طلب' },
  { key: Permissions.REFUND_ORDER, group: 'الطلبات', label: 'استرداد طلب' },
  {
    key: Permissions.VIEW_CATEGORIES,
    group: 'الفئات والأقسام',
    label: 'عرض الفئات',
  },
  {
    key: Permissions.MANAGE_CATEGORIES,
    group: 'الفئات والأقسام',
    label: 'إدارة الفئات',
  },
  {
    key: Permissions.VIEW_SUB_CATEGORIES,
    group: 'الفئات والأقسام',
    label: 'عرض الأقسام الفرعية',
  },
  {
    key: Permissions.MANAGE_SUB_CATEGORIES,
    group: 'الفئات والأقسام',
    label: 'إدارة الأقسام الفرعية',
  },
  {
    key: Permissions.VIEW_BRANDS,
    group: 'العلامات التجارية',
    label: 'عرض العلامات التجارية',
  },
  {
    key: Permissions.MANAGE_BRANDS,
    group: 'العلامات التجارية',
    label: 'إدارة العلامات التجارية',
  },
  {
    key: Permissions.VIEW_CAROUSEL,
    group: 'العروض المرئية',
    label: 'عرض شريط العروض (Carousel)',
  },
  {
    key: Permissions.MANAGE_CAROUSEL,
    group: 'العروض المرئية',
    label: 'إدارة شريط العروض',
  },
  {
    key: Permissions.VIEW_PROMO_BANNERS,
    group: 'الكوبونات والعروض',
    label: 'عرض البنرات الإعلانية',
  },
  {
    key: Permissions.MANAGE_PROMO_BANNERS,
    group: 'الكوبونات والعروض',
    label: 'إدارة البنرات الإعلانية',
  },
  {
    key: Permissions.MANAGE_COUPONS,
    group: 'الكوبونات والعروض',
    label: 'إدارة الكوبونات',
  },
  {
    key: Permissions.VIEW_SHIPPING,
    group: 'الشحن والضرائب',
    label: 'عرض إعدادات الشحن',
  },
  {
    key: Permissions.MANAGE_SHIPPING,
    group: 'الشحن والضرائب',
    label: 'إدارة الشحن',
  },
  {
    key: Permissions.MANAGE_TAXES,
    group: 'الشحن والضرائب',
    label: 'إدارة الضرائب',
  },
];
