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
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { VariantOperationsDto } from './variant.dto';
import { ProductAttributeDefinitionDto } from './create-product.dto';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';
import { SubCategory } from 'src/sub-category/shared/schemas/sub-category.schema';
import { Category } from 'src/categories/shared/schemas/category.schema';
import { Brand } from 'src/brands/shared/schemas/brand.schema';
import { Supplier } from 'src/supplier/shared/schema/Supplier.schema';

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
  @Exists(Category.name)
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
  @Exists(SubCategory.name)
  SubCategories?: string[];

  @IsMongoId()
  @IsOptional()
  @Exists(Brand.name)
  brand?: string;
  @IsMongoId()
  @IsOptional()
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
