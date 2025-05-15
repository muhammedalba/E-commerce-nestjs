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
} from 'class-validator';
import { Type } from 'class-transformer';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { IsLessThan } from 'src/shared/utils/validators/is-less-than.decorator';

export class CreateProductDto {
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  //   validaate opject in opject
  @ValidateNested()
  title!: FieldLocalizeDto;

  @IsString()
  @IsOptional()
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
  @Max(20000)
  @Type(() => Number)
  @IsLessThan('price', {
    message: 'Discounted price must be less than original price',
  })
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
