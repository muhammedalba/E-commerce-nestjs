import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SettingsService } from 'src/settings/settings.service';
import { roles } from 'src/auth/shared/enums/role.enum';
import { Roles_key } from 'src/auth/shared/decorators/roles.decorator';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. جلب الإعدادات وفحص وضع الصيانة
    const settings = await this.settingsService.getSettings();
    const isMaintenance = settings.maintenanceMode ?? false;

    if (!isMaintenance) {
      return true;
    }

    // 2. إذا كان وضع الصيانة مفعلاً، نتحقق هل المسار مخصص للآدمن؟
    const requiredRoles = this.reflector.getAllAndOverride<roles[]>(Roles_key, [
      context.getHandler(),
      context.getClass(),
    ]);

    // إذا كان المسار يتطلب دور ADMIN، نسمح بالمرور (ليتمكن الإدمن من الدخول وإيقاف وضع الصيانة)
    if (requiredRoles?.includes(roles.ADMIN)) {
      return true;
    }

    // 3. نتحقق من طلبات الـ Auth (Login/Register) لنسمح للإدمن بالدخول
    const request = context.switchToHttp().getRequest();
    const path = request.url;
    if (path.includes('/auth/login') || path.includes('/auth/verify')) {
      return true;
    }

    // 4. إذا لم يكن آدمن، نمنع الوصول
    const lang = request.headers['x-lang'] || 'ar';
    const message =
      settings.maintenanceMessage?.[lang] || 'الموقع قيد الصيانة حالياً';

    throw new ServiceUnavailableException(message);
  }
}
