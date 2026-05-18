import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsArray,
  Min,
  Max,
  IsNumber,
  IsDefined,
  ValidateNested,
  IsBoolean,
  ArrayMinSize,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Transform, Type } from 'class-transformer';

export class ProductAttributeDefinitionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  type!: 'string' | 'number';

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedUnits?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedValues?: string[];
}

import {
  FieldLocalizeDto,
  ArrayLocalizeDto,
} from 'src/shared/utils/field-locolaized.dto';
import { CreateVariantDto } from './variant.dto';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

export class CreateProductDto {
  // ─── Attribute Schema Versioning ───────────────────────
  @IsNumber()
  @IsOptional()
  allowedAttributesVersion?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeDefinitionDto)
  @IsOptional()
  allowedAttributes?: ProductAttributeDefinitionDto[];

  // ─── Localized Fields ──────────────────────────────────
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  title!: FieldLocalizeDto;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  description!: FieldLocalizeDto;

  @IsOptional()
  @Type(() => ArrayLocalizeDto)
  @ValidateNested()
  uses?: ArrayLocalizeDto;

  // ─── Media ─────────────────────────────────────────────

  @IsString()
  @IsOptional()
  imageCover?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  images?: string[] | string;

  @IsString()
  @IsOptional()
  infoProductPdf?: string;

  // ─── Classification ────────────────────────────────────
  @IsMongoId()
  @IsNotEmpty({ message: 'Category is required' })
  @Exists(MODEL_NAMES.CATEGORY)
  category!: string;

  @Transform(({ value }) => {
    const rawIds = Array.isArray(value) ? value : value ? [value] : [];
    return [
      ...new Set(
        rawIds.filter((id) => typeof id === 'string' && id.length > 0),
      ),
    ];
  })
  @IsArray()
  @IsMongoId({
    each: true,
    message: i18nValidationMessage('validation.IS_MONGO_ID'),
  })
  @IsOptional()
  @Exists(MODEL_NAMES.SUB_CATEGORY)
  SubCategories?: string[];

  @IsOptional()
  @IsMongoId()
  @Exists(MODEL_NAMES.BRAND)
  brand?: string;

  @IsOptional()
  @IsMongoId()
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

  // ─── Ratings (aggregated) ──────────────────────────────  @ApiPropertyOptional({

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

  // ─── Variants (required at creation) ───────────────────

  @IsDefined({ message: 'At least one variant is required' })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one variant is required' })
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants!: CreateVariantDto[];
}
