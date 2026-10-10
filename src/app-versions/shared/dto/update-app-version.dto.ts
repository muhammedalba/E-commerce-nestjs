import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsUrl,
  Matches,
  ValidateNested,
} from 'class-validator';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { APP_VERSION_PATTERN } from '../utils/compare-versions';

const VERSION_MESSAGE = 'version must look like 1.2.3';

/**
 * Body of `PATCH app-versions/:platform`. Omitted fields keep their value;
 * the service checks `minSupportedVersion <= latestVersion` on the result.
 */
export class UpdateAppVersionDto {
  @IsOptional()
  @Matches(APP_VERSION_PATTERN, { message: VERSION_MESSAGE })
  latestVersion?: string;

  @IsOptional()
  @Matches(APP_VERSION_PATTERN, { message: VERSION_MESSAGE })
  minSupportedVersion?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Matches(APP_VERSION_PATTERN, { each: true, message: VERSION_MESSAGE })
  blockedVersions?: string[];

  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'storeUrl must be an https link' },
  )
  storeUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  releaseNotes?: FieldLocalizeDto;
}
