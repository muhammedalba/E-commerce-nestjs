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
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MinLength(3)
  @MaxLength(70)
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  slug?: string;

  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MinLength(15)
  @MaxLength(2000)
  description!: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantity!: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  sold?: number;

  @IsNumber()
  @IsNotEmpty({ message: 'Price is required' })
  @Max(20000)
  @Type(() => Number)
  price!: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  priceAfterDiscount?: number;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  colors?: string[];
  @IsOptional()
  @IsString()
  // @IsNotEmpty({ message: 'Image cover is required' })
  imageCover!: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  images?: string[];

  @IsMongoId()
  @IsNotEmpty({ message: 'Category is required' })
  category!: string;

  @IsMongoId()
  @IsOptional()
  brand?: string;

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

  @IsString()
  @IsOptional()
  infoProductPdf?: string;
}
