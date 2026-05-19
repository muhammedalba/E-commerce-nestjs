import { IsString, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';

export enum NotificationTargetType {
  DIRECT = 'direct',
  BROADCAST = 'broadcast',
  ROLE = 'role',
}

export class SendNotificationDto {
  @IsEnum(NotificationTargetType, {
    message: 'نوع الهدف يجب أن يكون direct أو broadcast أو role',
  })
  @IsNotEmpty({ message: 'نوع الهدف مطلوب' })
  declare targetType: NotificationTargetType;

  @IsString({ message: 'معرف المستخدم يجب أن يكون نصاً' })
  @IsOptional()
  @Exists(MODEL_NAMES.USER)
  declare userId?: string;

  @IsString({ message: 'معرف الدور يجب أن يكون نصاً' })
  @IsOptional()
  @Exists(MODEL_NAMES.ROLE)
  declare roleId?: string;

  @IsString({ message: 'الإجراء يجب أن يكون نصاً' })
  @IsOptional()
  declare action?: string;

  @IsString({ message: 'نص الإشعار يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'نص الإشعار مطلوب' })
  declare message: string;

  @IsOptional()
  declare payload?: unknown;
}
