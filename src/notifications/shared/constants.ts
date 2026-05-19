export interface NotificationAction {
  value: string;
  label: {
    ar: string;
    en: string;
  };
}

export const UNIFIED_NOTIFICATION_ACTIONS: NotificationAction[] = [
  {
    value: 'GENERAL',
    label: {
      ar: 'إشعار عام',
      en: 'General Notification',
    },
  },
  {
    value: 'SYSTEM_UPDATE',
    label: {
      ar: 'تحديث النظام',
      en: 'System Update',
    },
  },
  {
    value: 'ADMIN_ALERT',
    label: {
      ar: 'تنبيه إداري هام',
      en: 'Important Admin Alert',
    },
  },
  {
    value: 'PROMOTION',
    label: {
      ar: 'عرض ترويجي / خصم',
      en: 'Promotion / Discount',
    },
  },
  {
    value: 'ORDER_UPDATE',
    label: {
      ar: 'تحديث حالة الطلب',
      en: 'Order Status Update',
    },
  },
  {
    value: 'CUSTOM',
    label: {
      ar: 'أخرى / إجراء مخصص',
      en: 'Other / Custom Action',
    },
  },
];
