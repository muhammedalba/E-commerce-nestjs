import { I18nContext } from "nestjs-i18n";
import { Types } from "mongoose";

export class I18nHelper {
  static getCurrentLang(): string {
    return I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
  }

  /**
   * دالة شاملة لتوطين البيانات تدعم الكائنات والمصفوفات المتداخلة
   */
  static localize(data: any, allLangs: boolean = false) {
    if (allLangs || !data) return data;
    const lang = this.getCurrentLang();

    const translate = (obj: any): any => {
      // 1. إذا كان العنصر ليس كائناً أو كان null
      if (!obj || typeof obj !== 'object') return obj;

      // 2. إذا كان ObjectID أو Date أو Buffer، نرجعه كما هو (مع تحويل ObjectID لنص)
      if (obj instanceof Types.ObjectId) return obj.toString();
      if (obj instanceof Date) return obj;

      // 3. إذا كان العنصر مصفوفة، نقوم بترجمة كل عنصر بداخلها
      if (Array.isArray(obj)) {
        return obj.map((item) => translate(item));
      }

      // 4. تحويل Mongoose Document إلى Object بسيط
      let raw = obj.toObject ? obj.toObject() : { ...obj };

      // 5. ترجمة الحقول النصية المباشرة (name, title, description, etc.)
      const translatableFields = ['name', 'title', 'description', 'text'];
      translatableFields.forEach((field) => {
        if (raw[field] && typeof raw[field] === 'object' && !Array.isArray(raw[field])) {
          // التأكد أن الكائن يحتوي على مفاتيح لغات وليس كائناً عادياً
          if (raw[field][lang] || raw[field]['en'] || raw[field]['ar']) {
            raw[field] = raw[field][lang] || raw[field]['en'] || raw[field]['ar'] || raw[field];
          }
        }
      });

      // 6. ترجمة الحقول المتداخلة (Recursive) أياً كان نوعها (Object أو Array)
      // أضفنا supCategories هنا ليتم فحصها كـ Array of Objects
      const nestedFields = ['category', 'brand', 'supplier', 'supCategories', 'product', 'variants'];
      nestedFields.forEach((key) => {
        if (raw[key]) {
          raw[key] = translate(raw[key]);
        }
      });

      return raw;
    };

    return Array.isArray(data) ? data.map((item) => translate(item)) : translate(data);
  }
}