import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { APP_VERSION_PATTERN } from 'src/app-versions/shared/utils/compare-versions';
import { DevicePlatform } from '../schemas/device-token.schema';

/** Body of `PUT push/devices`: the install's current FCM token. */
export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty({ message: 'token is required' })
  @MaxLength(4096)
  token!: string;

  @IsEnum(DevicePlatform, { message: 'platform must be android or ios' })
  platform!: DevicePlatform;

  /** Language of the notifications; defaults to the request language. */
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en';

  /** Installed app version, e.g. `1.4.2`. */
  @IsOptional()
  @Matches(APP_VERSION_PATTERN, { message: 'appVersion must look like 1.2.3' })
  appVersion?: string;
}

/** Body of `DELETE push/devices`. */
export class UnregisterDeviceDto {
  @IsString()
  @IsNotEmpty({ message: 'token is required' })
  @MaxLength(4096)
  token!: string;
}
