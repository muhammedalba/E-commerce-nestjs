import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsMongoId,
  IsArray,
  Min,
  Max,
  MaxLength,
  MinLength,
  IsPositive,
  IsDefined,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { IsLessThan } from 'src/shared/utils/validators/is-less-than.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({
    description: 'Localized title of the product',
    type: () => FieldLocalizeDto,
    example: { en: 'Product Title (English)', ar: 'عنوان المنتج (العربية)' },
  })
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  title!: FieldLocalizeDto;

  @ApiPropertyOptional({
    description: 'Slug for the product (auto-generated if not provided)',
    example: 'product-title-english',
  })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Indicates if the product has unlimited stock',
    type: Boolean,
    default: false,
    example: false,
  })
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  isUnlimitedStock?: boolean;

  @ApiProperty({
    description: 'Description of the product',
    example: 'This is a detailed description of the product.',
    minLength: 15,
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MinLength(15)
  @MaxLength(2000)
  description!: string;

  @ApiProperty({
    description: 'Quantity of the product in stock',
    example: 100,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Number of units sold',
    example: 10,
    default: 0,
    minimum: 0,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  sold?: number;

  @ApiProperty({
    description: 'Original price of the product',
    example: 150.00,
    maximum: 20000,
  })
  @IsNumber()
  @IsNotEmpty({ message: 'Price is required' })
  @Max(20000)
  @Type(() => Number)
  price!: number;

  @ApiPropertyOptional({
    description: 'Discounted price of the product (must be less than original price)',
    example: 120.00,
    maximum: 20000,
  })
  @IsNumber()
  @IsOptional()
  @Max(20000)
  @Type(() => Number)
  @IsLessThan('price', {
    message: 'Discounted price must be less than original price',
  })
  priceAfterDiscount?: number;

  @ApiPropertyOptional({
    description: 'Array of available colors for the product',
    type: [String],
    example: ['red', 'blue'],
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  colors?: string[];

  @ApiProperty({
    description: 'Cover image of the product',
    type: 'string',
    format: 'binary',
    required: true,
  })
  @IsOptional()
  @IsString()
  imageCover!: string;

  @ApiPropertyOptional({
    description: 'Additional images of the product',
    type: 'array',
    items: { type: 'string', format: 'binary' },
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({
    description: 'ID of the product category',
    example: '60d5ecf4f8e7c10015f8e7c1',
  })
  @IsMongoId()
  @IsNotEmpty({ message: 'Category is required' })
  category!: string;

  @ApiPropertyOptional({
    description: 'Array of sub-category IDs for the product',
    type: [String],
    example: ['60d5ecf4f8e7c10015f8e7c2', '60d5ecf4f8e7c10015f8e7c3'],
  })
  @IsArray()
  @IsMongoId({
    each: true,
    message: 'كل عنصر في supCategories يجب أن يكون MongoId',
  })
  @IsOptional()
  supCategories?: string[];

  @ApiPropertyOptional({
    description: 'ID of the product brand',
    example: '60d5ecf4f8e7c10015f8e7c4',
  })
  @IsMongoId()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({
    description: 'ID of the product supplier',
    example: '60d5ecf4f8e7c10015f8e7c5',
  })
  @IsMongoId()
  @IsOptional()
  supplier?: string;

  @ApiPropertyOptional({
    description: 'Rating of the product (1-5)',
    example: 4.5,
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @ApiPropertyOptional({
    description: 'Number of ratings received',
    example: 120,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  ratingsQuantity?: number;

  @ApiPropertyOptional({
    description: 'Average rating of the product (0-5)',
    example: 4.2,
    minimum: 0,
    maximum: 5,
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  @Type(() => Number)
  ratingsAverage?: number;

  @ApiPropertyOptional({
    description: 'PDF file containing product information',
    type: 'string',
    format: 'binary',
  })
  @IsString()
  @IsOptional()
  infoProductPdf?: string;
}
