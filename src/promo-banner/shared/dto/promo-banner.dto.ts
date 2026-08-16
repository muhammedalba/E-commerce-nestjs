import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsOptional,
  ValidateBy,
  ValidateNested,
} from 'class-validator';
import { PromoBannerLocalizeDto } from 'src/shared/utils/PromoBanner-ocolaized.dto';

function isSafePromoBannerLink(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  const link = value.trim();
  if (!link) return true;
  if (/[\u0000-\u001F\u007F\s]/.test(link)) return false;

  if (link.startsWith('/')) {
    return !link.startsWith('//') && !link.includes('\\');
  }

  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export class PromoBannerDto {
  @IsDefined()
  @Type(() => PromoBannerLocalizeDto)
  @ValidateNested()
  text!: PromoBannerLocalizeDto;

  @ValidateBy(
    {
      name: 'isSafePromoBannerLink',
      validator: {
        validate: isSafePromoBannerLink,
      },
    },
    { message: 'validation.INVALID_URL' },
  )
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : String(value),
  )
  link?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}
