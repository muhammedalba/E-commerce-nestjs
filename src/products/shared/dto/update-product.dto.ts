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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VariantOperationsDto } from './variant.dto';
import { ProductAttributeDefinitionDto } from './create-product.dto';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';
import { SupCategory } from 'src/sup-category/shared/schemas/sup-category.schema';
import { Category } from 'src/categories/shared/schemas/category.schema';
import { Brand } from 'src/brands/shared/schemas/brand.schema';
import { Supplier } from 'src/supplier/shared/schema/Supplier.schema';

export class UpdateProductDto {
  // ─── Localized Fields ──────────────────────────────────
  @ApiPropertyOptional({
    description: 'Localized title of the product',
    type: () => FieldLocalizeDto,
  })
  @IsOptional()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  title?: FieldLocalizeDto;

  @ApiPropertyOptional({ description: 'Slug for the product' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ description: 'Description of the product' })
  @IsOptional()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  description?: FieldLocalizeDto;

  // ─── Media ─────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Cover image of the product' })
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

  @ApiPropertyOptional({ description: 'PDF file' })
  @IsString()
  @IsOptional()
  infoProductPdf?: string;

  // ─── Classification ────────────────────────────────────
  @ApiPropertyOptional({ description: 'Category ID' })
  @IsMongoId()
  @IsOptional()
  @Exists(Category.name)
  category?: string;

  @ApiPropertyOptional({ description: 'Sub-category IDs' })
  @IsOptional()
  @Transform(({ value }) => {
    const rawIds = Array.isArray(value) ? value : (value ? [value] : []);
    return [...new Set(rawIds.filter((id) => typeof id === 'string' && id.length > 0))];
  })
  @IsArray()
  @IsMongoId({ each: true })
  @Exists(SupCategory.name)
  supCategories?: string[];

  @ApiPropertyOptional({ description: 'Brand ID' })
  @IsMongoId()
  @IsOptional()
  @Exists(Brand.name)
  brand?: string;

  @ApiPropertyOptional({ description: 'Supplier ID' })
  @IsMongoId()
  @IsOptional()
  @Exists(Supplier.name)
  supplier?: string;

  // ─── Flags ─────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Unlimited stock flag' })
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  isUnlimitedStock?: boolean;

  @ApiPropertyOptional({ description: 'Is featured?' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Is disabled?' })
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  disabled?: boolean;

  // ─── Ratings ───────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Rating (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @ApiPropertyOptional({ description: 'Number of ratings' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  ratingsQuantity?: number;

  @ApiPropertyOptional({ description: 'Average rating (0-5)' })
  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  @Type(() => Number)
  ratingsAverage?: number;

  // ─── Variant Operations ────────────────────────────────
  @ApiPropertyOptional({
    description: 'Variant operations: create, update, delete',
    type: VariantOperationsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => VariantOperationsDto)
  variants?: VariantOperationsDto;

  // ─── Attribute Definitions ─────────────────────────────
  @ApiPropertyOptional({
    description: 'Dynamic schema definition for allowed attributes',
    type: [ProductAttributeDefinitionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeDefinitionDto)
  @IsOptional()
  allowedAttributes?: ProductAttributeDefinitionDto[];
}
