import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
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
}

/** Body of `DELETE push/devices`. */
export class UnregisterDeviceDto {
  @IsString()
  @IsNotEmpty({ message: 'token is required' })
  @MaxLength(4096)
  token!: string;
}
