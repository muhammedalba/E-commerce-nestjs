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

  @ApiPropertyOptional({ description: 'Additional images' })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: 'PDF file' })
  @IsString()
  @IsOptional()
  infoProductPdf?: string;

  // ─── Classification ────────────────────────────────────
  @ApiPropertyOptional({ description: 'Category ID' })
  @IsMongoId()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Sub-category IDs' })
  @Transform(({ value }: { value: unknown }): unknown => {
    if (Array.isArray(value)) return value;
    if (value !== undefined && value !== null && value !== '') return [value];
    return [];
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  supCategories?: string[];

  @ApiPropertyOptional({ description: 'Brand ID' })
  @IsMongoId()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ description: 'Supplier ID' })
  @IsMongoId()
  @IsOptional()
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
