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

export class CreateProductDto {
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  //   validaate opject in opject
  @ValidateNested()
  title!: FieldLocalizeDto;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  isUnlimitedStock?: boolean;

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
  @Min(0)
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
  imageCover!: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  images?: string[];

  @IsMongoId()
  @IsNotEmpty({ message: 'Category is required' })
  category!: string;

  @IsArray()
  @IsMongoId({
    each: true,
    message: 'كل عنصر في supCategories يجب أن يكون MongoId',
  })
  @IsOptional()
  supCategories?: string[];

  @IsMongoId()
  @IsOptional()
  brand?: string;

  @IsMongoId()
  @IsOptional()
  supplier?: string;

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
