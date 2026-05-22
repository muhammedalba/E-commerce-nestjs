export interface PermissionMetadata {
  key: Permissions;
  /** مفتاح الترجمة لاسم الصلاحية — مثال: 'permissions.labels.view_users' */
  labelKey: string;
  /** مفتاح الترجمة لاسم المجموعة — مثال: 'permissions.groups.users' */
  groupKey: string;
}

export enum Permissions {
  // ---- Dashboard Access ----
  ACCESS_DASHBOARD = 'access_dashboard',
  VIEW_DASHBOARD_STATS = 'view_dashboard_stats',

  // ---- Settings ----
  VIEW_SETTINGS = 'view_settings',
  UPDATE_SETTINGS = 'update_settings',
  UPDATE_MAINTENANCE = 'update_maintenance',
  UPDATE_DEBUG = 'update_debug',

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
  // ── Dashboard ─────────────────────────────────────────────────────────────
  {
    key: Permissions.ACCESS_DASHBOARD,
    groupKey: 'permissions.groups.dashboard',
    labelKey: 'permissions.labels.access_dashboard',
  },
  {
    key: Permissions.VIEW_DASHBOARD_STATS,
    groupKey: 'permissions.groups.dashboard',
    labelKey: 'permissions.labels.view_dashboard_stats',
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  {
    key: Permissions.VIEW_SETTINGS,
    groupKey: 'permissions.groups.settings',
    labelKey: 'permissions.labels.view_settings',
  },
  {
    key: Permissions.UPDATE_SETTINGS,
    groupKey: 'permissions.groups.settings',
    labelKey: 'permissions.labels.update_settings',
  },
  {
    key: Permissions.UPDATE_MAINTENANCE,
    groupKey: 'permissions.groups.settings',
    labelKey: 'permissions.labels.update_maintenance',
  },
  {
    key: Permissions.UPDATE_DEBUG,
    groupKey: 'permissions.groups.settings',
    labelKey: 'permissions.labels.update_debug',
  },
  {
    key: Permissions.VIEW_LOCATIONS,
    groupKey: 'permissions.groups.settings',
    labelKey: 'permissions.labels.view_locations',
  },
  {
    key: Permissions.CREATE_LOCATION,
    groupKey: 'permissions.groups.settings',
    labelKey: 'permissions.labels.create_location',
  },
  {
    key: Permissions.UPDATE_LOCATION,
    groupKey: 'permissions.groups.settings',
    labelKey: 'permissions.labels.update_location',
  },
  {
    key: Permissions.DELETE_LOCATION,
    groupKey: 'permissions.groups.settings',
    labelKey: 'permissions.labels.delete_location',
  },
  {
    key: Permissions.VIEW_EXTERNAL_PLATFORMS,
    groupKey: 'permissions.groups.settings',
    labelKey: 'permissions.labels.view_external_platforms',
  },

  // ── Roles & Permissions ───────────────────────────────────────────────────
  {
    key: Permissions.VIEW_ROLES,
    groupKey: 'permissions.groups.roles_permissions',
    labelKey: 'permissions.labels.view_roles',
  },
  {
    key: Permissions.CREATE_ROLE,
    groupKey: 'permissions.groups.roles_permissions',
    labelKey: 'permissions.labels.create_role',
  },
  {
    key: Permissions.UPDATE_ROLE,
    groupKey: 'permissions.groups.roles_permissions',
    labelKey: 'permissions.labels.update_role',
  },
  {
    key: Permissions.DELETE_ROLE,
    groupKey: 'permissions.groups.roles_permissions',
    labelKey: 'permissions.labels.delete_role',
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  {
    key: Permissions.VIEW_USERS,
    groupKey: 'permissions.groups.users',
    labelKey: 'permissions.labels.view_users',
  },
  {
    key: Permissions.CREATE_USER,
    groupKey: 'permissions.groups.users',
    labelKey: 'permissions.labels.create_user',
  },
  {
    key: Permissions.UPDATE_USER,
    groupKey: 'permissions.groups.users',
    labelKey: 'permissions.labels.update_user',
  },
  {
    key: Permissions.DELETE_USER,
    groupKey: 'permissions.groups.users',
    labelKey: 'permissions.labels.delete_user',
  },

  // ── Suppliers ─────────────────────────────────────────────────────────────
  {
    key: Permissions.VIEW_SUPPLIERS,
    groupKey: 'permissions.groups.suppliers',
    labelKey: 'permissions.labels.view_suppliers',
  },
  {
    key: Permissions.CREATE_SUPPLIER,
    groupKey: 'permissions.groups.suppliers',
    labelKey: 'permissions.labels.create_supplier',
  },
  {
    key: Permissions.UPDATE_SUPPLIER,
    groupKey: 'permissions.groups.suppliers',
    labelKey: 'permissions.labels.update_supplier',
  },
  {
    key: Permissions.DELETE_SUPPLIER,
    groupKey: 'permissions.groups.suppliers',
    labelKey: 'permissions.labels.delete_supplier',
  },

  // ── Products ──────────────────────────────────────────────────────────────
  {
    key: Permissions.VIEW_PRODUCTS,
    groupKey: 'permissions.groups.products',
    labelKey: 'permissions.labels.view_products',
  },
  {
    key: Permissions.VIEW_PRODUCTS_STATS,
    groupKey: 'permissions.groups.products',
    labelKey: 'permissions.labels.view_products_stats',
  },
  {
    key: Permissions.CREATE_PRODUCT,
    groupKey: 'permissions.groups.products',
    labelKey: 'permissions.labels.create_product',
  },
  {
    key: Permissions.UPDATE_PRODUCT,
    groupKey: 'permissions.groups.products',
    labelKey: 'permissions.labels.update_product',
  },
  {
    key: Permissions.DELETE_PRODUCT,
    groupKey: 'permissions.groups.products',
    labelKey: 'permissions.labels.delete_product',
  },

  // ── Orders ────────────────────────────────────────────────────────────────
  {
    key: Permissions.VIEW_ORDERS,
    groupKey: 'permissions.groups.orders',
    labelKey: 'permissions.labels.view_orders',
  },
  {
    key: Permissions.UPDATE_ORDER_STATUS,
    groupKey: 'permissions.groups.orders',
    labelKey: 'permissions.labels.update_order_status',
  },
  {
    key: Permissions.DELETE_ORDER,
    groupKey: 'permissions.groups.orders',
    labelKey: 'permissions.labels.delete_order',
  },
  {
    key: Permissions.REFUND_ORDER,
    groupKey: 'permissions.groups.orders',
    labelKey: 'permissions.labels.refund_order',
  },

  // ── Categories & Subcategories ────────────────────────────────────────────
  {
    key: Permissions.VIEW_CATEGORIES,
    groupKey: 'permissions.groups.categories_subcategories',
    labelKey: 'permissions.labels.view_categories',
  },
  {
    key: Permissions.CREATE_CATEGORY,
    groupKey: 'permissions.groups.categories_subcategories',
    labelKey: 'permissions.labels.create_category',
  },
  {
    key: Permissions.UPDATE_CATEGORY,
    groupKey: 'permissions.groups.categories_subcategories',
    labelKey: 'permissions.labels.update_category',
  },
  {
    key: Permissions.DELETE_CATEGORY,
    groupKey: 'permissions.groups.categories_subcategories',
    labelKey: 'permissions.labels.delete_category',
  },
  {
    key: Permissions.VIEW_SUB_CATEGORIES,
    groupKey: 'permissions.groups.categories_subcategories',
    labelKey: 'permissions.labels.view_sub_categories',
  },
  {
    key: Permissions.CREATE_SUB_CATEGORY,
    groupKey: 'permissions.groups.categories_subcategories',
    labelKey: 'permissions.labels.create_sub_category',
  },
  {
    key: Permissions.UPDATE_SUB_CATEGORY,
    groupKey: 'permissions.groups.categories_subcategories',
    labelKey: 'permissions.labels.update_sub_category',
  },
  {
    key: Permissions.DELETE_SUB_CATEGORY,
    groupKey: 'permissions.groups.categories_subcategories',
    labelKey: 'permissions.labels.delete_sub_category',
  },

  // ── Brands ────────────────────────────────────────────────────────────────
  {
    key: Permissions.VIEW_BRANDS,
    groupKey: 'permissions.groups.brands',
    labelKey: 'permissions.labels.view_brands',
  },
  {
    key: Permissions.CREATE_BRAND,
    groupKey: 'permissions.groups.brands',
    labelKey: 'permissions.labels.create_brand',
  },
  {
    key: Permissions.UPDATE_BRAND,
    groupKey: 'permissions.groups.brands',
    labelKey: 'permissions.labels.update_brand',
  },
  {
    key: Permissions.DELETE_BRAND,
    groupKey: 'permissions.groups.brands',
    labelKey: 'permissions.labels.delete_brand',
  },

  // ── Carousels ─────────────────────────────────────────────────────────────
  {
    key: Permissions.VIEW_CAROUSEL,
    groupKey: 'permissions.groups.carousels',
    labelKey: 'permissions.labels.view_carousels',
  },
  {
    key: Permissions.CREATE_CAROUSEL,
    groupKey: 'permissions.groups.carousels',
    labelKey: 'permissions.labels.create_carousel',
  },
  {
    key: Permissions.UPDATE_CAROUSEL,
    groupKey: 'permissions.groups.carousels',
    labelKey: 'permissions.labels.update_carousel',
  },
  {
    key: Permissions.DELETE_CAROUSEL,
    groupKey: 'permissions.groups.carousels',
    labelKey: 'permissions.labels.delete_carousel',
  },

  // ── Coupons & Promo ───────────────────────────────────────────────────────
  {
    key: Permissions.VIEW_COUPONS,
    groupKey: 'permissions.groups.coupons_offers',
    labelKey: 'permissions.labels.view_coupons',
  },
  {
    key: Permissions.CREATE_COUPON,
    groupKey: 'permissions.groups.coupons_offers',
    labelKey: 'permissions.labels.create_coupon',
  },
  {
    key: Permissions.UPDATE_COUPON,
    groupKey: 'permissions.groups.coupons_offers',
    labelKey: 'permissions.labels.update_coupon',
  },
  {
    key: Permissions.DELETE_COUPON,
    groupKey: 'permissions.groups.coupons_offers',
    labelKey: 'permissions.labels.delete_coupon',
  },
  {
    key: Permissions.VIEW_PROMO_BANNERS,
    groupKey: 'permissions.groups.coupons_offers',
    labelKey: 'permissions.labels.view_promo_banners',
  },
  {
    key: Permissions.CREATE_PROMO_BANNER,
    groupKey: 'permissions.groups.coupons_offers',
    labelKey: 'permissions.labels.create_promo_banner',
  },
  {
    key: Permissions.UPDATE_PROMO_BANNER,
    groupKey: 'permissions.groups.coupons_offers',
    labelKey: 'permissions.labels.update_promo_banner',
  },
  {
    key: Permissions.DELETE_PROMO_BANNER,
    groupKey: 'permissions.groups.coupons_offers',
    labelKey: 'permissions.labels.delete_promo_banner',
  },

  // ── Shipping & Taxes ──────────────────────────────────────────────────────
  {
    key: Permissions.VIEW_SHIPPING,
    groupKey: 'permissions.groups.shipping_taxes',
    labelKey: 'permissions.labels.view_shipping',
  },
  {
    key: Permissions.CREATE_SHIPPING,
    groupKey: 'permissions.groups.shipping_taxes',
    labelKey: 'permissions.labels.create_shipping',
  },
  {
    key: Permissions.UPDATE_SHIPPING,
    groupKey: 'permissions.groups.shipping_taxes',
    labelKey: 'permissions.labels.update_shipping',
  },
  {
    key: Permissions.DELETE_SHIPPING,
    groupKey: 'permissions.groups.shipping_taxes',
    labelKey: 'permissions.labels.delete_shipping',
  },
  {
    key: Permissions.VIEW_SHIPPING_RATES,
    groupKey: 'permissions.groups.shipping_taxes',
    labelKey: 'permissions.labels.view_shipping_rates',
  },
  {
    key: Permissions.VIEW_TAXES,
    groupKey: 'permissions.groups.shipping_taxes',
    labelKey: 'permissions.labels.view_taxes',
  },
  {
    key: Permissions.CREATE_TAX,
    groupKey: 'permissions.groups.shipping_taxes',
    labelKey: 'permissions.labels.create_tax',
  },
  {
    key: Permissions.UPDATE_TAX,
    groupKey: 'permissions.groups.shipping_taxes',
    labelKey: 'permissions.labels.update_tax',
  },
  {
    key: Permissions.DELETE_TAX,
    groupKey: 'permissions.groups.shipping_taxes',
    labelKey: 'permissions.labels.delete_tax',
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  {
    key: Permissions.VIEW_NOTIFICATIONS,
    groupKey: 'permissions.groups.notifications',
    labelKey: 'permissions.labels.view_notifications',
  },
  {
    key: Permissions.SEND_NOTIFICATION,
    groupKey: 'permissions.groups.notifications',
    labelKey: 'permissions.labels.send_notification',
  },
  {
    key: Permissions.DELETE_NOTIFICATION,
    groupKey: 'permissions.groups.notifications',
    labelKey: 'permissions.labels.delete_notification',
  },
];
