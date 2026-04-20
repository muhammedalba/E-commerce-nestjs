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
import { Exists } from 'src/shared/utils/decorators/exists.decorator';
import { Category } from 'src/categories/shared/schemas/category.schema';
import { SupCategory } from 'src/sup-category/shared/schemas/sup-category.schema';
import { Brand } from 'src/brands/shared/schemas/brand.schema';
import { Supplier } from 'src/supplier/shared/schema/Supplier.schema';

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
  images?: string[] | string;

  @IsString()
  @IsOptional()
  infoProductPdf?: string;

  // ─── Classification ────────────────────────────────────
  @IsMongoId()
  @IsNotEmpty({ message: 'Category is required' })
  @Exists(Category.name)
  category!: string;

  @Transform(({ value }) => {
    const rawIds = Array.isArray(value) ? value : (value ? [value] : []);
    return [...new Set(rawIds.filter((id) => typeof id === 'string' && id.length > 0))];
  })
  @IsArray()
  @IsMongoId({
    each: true,
    message: 'كل عنصر في supCategories يجب أن يكون MongoId',
  })
  @IsOptional()
  @Exists(SupCategory.name)
  supCategories?: string[];

  @IsOptional()
  @IsMongoId()
  @Exists(Brand.name)
  brand?: string;

  @IsOptional()
  @IsMongoId()
  @Exists(Supplier.name)
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
