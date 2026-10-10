import { IsEnum, Matches } from 'class-validator';
import { DevicePlatform } from 'src/notifications/push/schemas/device-token.schema';
import { APP_VERSION_PATTERN } from '../utils/compare-versions';

/** Query of `GET app-versions/check`: the calling install. */
export class CheckVersionDto {
  @IsEnum(DevicePlatform, { message: 'platform must be android or ios' })
  platform!: DevicePlatform;

  @Matches(APP_VERSION_PATTERN, { message: 'version must look like 1.2.3' })
  version!: string;
}
