import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Setting, SettingDocument } from './shared/schema/setting.schema';
import { UpdateSettingDto } from './shared/dto/update-setting.dto';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { MulterFilesType } from 'src/shared/utils/interfaces/fileInterface';

const SETTINGS_CACHE_KEY = 'settings:global';
const SETTINGS_DOC_KEY = 'global'; // 1. استخراج الكلمة المفتاحية لتجنب تكرارها
const SETTINGS_CACHE_TTL = 3600000; // 1 hour in ms

@Injectable()
export class SettingsService {
  // 2. إضافة Logger لتسجيل الأخطاء بدلاً من تجاهلها بصمت
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectModel(Setting.name)
    private readonly settingModel: Model<SettingDocument>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,

    private readonly fileUploadService: FileUploadService,
  ) { }

  /**
   * جلب الإعدادات - يبحث في الـ Cache أولاً، إذا لم يجد يبحث في MongoDB
   */
  async getSettings(): Promise<Setting> { // 3. إرجاع كائن عادي (Setting) بدلاً من Document
    // 1. فحص الـ Cache
    const cached = await this.cacheManager.get<Setting>(SETTINGS_CACHE_KEY);
    if (cached) return cached;

    // 2. جلب من MongoDB أو إنشاء سجل افتراضي (Upsert)
    const settings = await this.settingModel.findOneAndUpdate(
      { key: SETTINGS_DOC_KEY },
      { $setOnInsert: { key: SETTINGS_DOC_KEY } },
      // 4. استخدام lean: true لتحسين الأداء وتقليل استهلاك الذاكرة
      { upsert: true, new: true, lean: true },
    );

    // 3. تخزين في الـ Cache
    await this.cacheManager.set(SETTINGS_CACHE_KEY, settings, SETTINGS_CACHE_TTL);

    return settings as Setting;
  }

  /**
   * تحديث الإعدادات وإلغاء الـ Cache
   */
  async updateSettings(
    dto: UpdateSettingDto,
    files?: { favicon?: MulterFilesType; logo?: MulterFilesType },
  ): Promise<Setting> {
    const currentSettings = await this.getSettings();
    // 5. التخلص من 'any' واستخدام Partial لضمان Type Safety
    const updateData: Record<string, any> = { ...dto };
    const imageFields = ['favicon', 'logo'] as const;
   
    console.log('files', files);
    // 6. استخدام Promise.all لمعالجة رفع الصور بالتوازي (Parallel) لتحسين السرعة
    await Promise.all(
      imageFields.map(async (key) => {
        const fileArray = files?.[key];
        const file = fileArray?.[0];
        const dtoValue = (dto as any)[key];
        const oldPath = currentSettings[key as keyof Setting] as string;

        if (file) {
          // CASE A: New File Uploaded
          const newPath = await this.fileUploadService.updateFile(
            file,
            Setting.name,
            currentSettings,
            oldPath,
          );
          updateData[key] = newPath;
        } else if (dtoValue === 'null' || dtoValue === null) {
          // CASE B: Image Deleted
          if (oldPath) {
            // 7. تسجيل الخطأ بدلاً من تجاهله تماماً
            await this.fileUploadService.deleteFile(oldPath).catch((err) => {
              this.logger.error(`Failed to delete old ${key}: ${oldPath}`, err.stack);
            });
          }
          updateData[key] = null;
        } else {
          // CASE C: No change
          delete updateData[key];
        }
      }),
    );

    // 5) Save the document
    const updatedDoc = await this.settingModel.findOneAndUpdate(
      { key: SETTINGS_DOC_KEY },
      { $set: updateData },
      { upsert: true, new: true, lean: true }, // استخدام lean هنا أيضاً
    );

    // إلغاء الـ Cache لإجبار إعادة جلب البيانات في الطلب القادم
    await this.cacheManager.del(SETTINGS_CACHE_KEY);

    return updatedDoc as Setting;
  }

  /**
   * جلب حد الشحن المجاني فقط - مستخدم في CheckoutService
   */
  async getFreeShippingThreshold(): Promise<number> {
    const settings = await this.getSettings();
    return settings.freeShippingThreshold ?? 0;
  }

  /**
   * فحص هل الموقع في وضع الصيانة
   */
  async isMaintenanceMode(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.maintenanceMode ?? false;
  }

  /**
   * مسح كافة التخزين المؤقت للإعدادات
   */
  async clearCache(): Promise<{ success: boolean }> {
    await this.cacheManager.del(SETTINGS_CACHE_KEY);
    return { success: true };
  }
}