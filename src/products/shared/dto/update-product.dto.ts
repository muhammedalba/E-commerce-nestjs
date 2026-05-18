import {
  IsString,
  IsOptional,
  IsMongoId,
  IsArray,
  Min,
  Max,
  IsNumber,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  FieldLocalizeDto,
  ArrayLocalizeDto,
} from 'src/shared/utils/field-locolaized.dto';
import { VariantOperationsDto } from './variant.dto';
import { ProductAttributeDefinitionDto } from './create-product.dto';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

export class UpdateProductDto {
  // ─── Localized Fields ──────────────────────────────────
  @IsOptional()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  title?: FieldLocalizeDto;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsOptional()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  description?: FieldLocalizeDto;

  @IsOptional()
  @Type(() => ArrayLocalizeDto)
  @ValidateNested()
  uses?: ArrayLocalizeDto;

  // ─── Media ─────────────────────────────────────────────
  @IsOptional()
  @IsString()
  imageCover?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (value !== undefined && value !== null && value !== '') return [value];
    return [];
  })
  images?: string[] | string;

  @IsString()
  @IsOptional()
  infoProductPdf?: string;

  // ─── Classification ────────────────────────────────────
  @IsMongoId()
  @IsOptional()
  @Exists(MODEL_NAMES.CATEGORY)
  category?: string;
  @IsOptional()
  @Transform(({ value }) => {
    const rawIds = Array.isArray(value) ? value : value ? [value] : [];
    return [
      ...new Set(
        rawIds.filter((id) => typeof id === 'string' && id.length > 0),
      ),
    ];
  })
  @IsArray()
  @IsMongoId({ each: true })
  @Exists(MODEL_NAMES.SUB_CATEGORY)
  SubCategories?: string[];

  @IsMongoId()
  @IsOptional()
  @Exists(MODEL_NAMES.BRAND)
  brand?: string;
  @IsMongoId()
  @IsOptional()
  @Exists(MODEL_NAMES.SUPPLIER)
  supplier?: string;

  // ─── Flags ─────────────────────────────────────────────
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  isUnlimitedStock?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isFeatured?: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  isActive?: boolean;

  // ─── Ratings ───────────────────────────────────────────
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  ratingsQuantity?: number;

  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  @Type(() => Number)
  ratingsAverage?: number;

  // ─── Variant Operations ────────────────────────────────
  @IsOptional()
  @ValidateNested()
  @Type(() => VariantOperationsDto)
  variants?: VariantOperationsDto;

  // ─── Attribute Definitions ─────────────────────────────

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeDefinitionDto)
  @IsOptional()
  allowedAttributes?: ProductAttributeDefinitionDto[];
}
