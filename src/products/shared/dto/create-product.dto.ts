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

import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { CreateVariantDto } from './variant.dto';

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

  // ─── Media ─────────────────────────────────────────────

  @IsString()
  @IsOptional()
  imageCover?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  images?: string[];

  @IsString()
  @IsOptional()
  infoProductPdf?: string;

  // ─── Classification ────────────────────────────────────
  @IsMongoId()
  @IsNotEmpty({ message: 'Category is required' })
  category!: string;

  @Transform(({ value }: { value: unknown }): unknown => {
    if (Array.isArray(value)) return value;
    if (value !== undefined && value !== null && value !== '') return [value];
    return [];
  })
  @IsArray()
  @IsMongoId({
    each: true,
    message: 'كل عنصر في supCategories يجب أن يكون MongoId',
  })
  @IsOptional()
  supCategories?: string[];

  @IsOptional()
  @IsMongoId()
  brand?: string;

  @IsOptional()
  @IsMongoId()
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
  disabled?: boolean;

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
