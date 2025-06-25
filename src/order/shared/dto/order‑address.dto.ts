import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
class GeoLocationDto {
  @IsString()
  type?: 'Point';

  @IsArray()
  @ArrayMinSize(2, { message: 'coordinates must contain exactly 2 numbers' })
  @ArrayMaxSize(2, { message: 'coordinates must contain exactly 2 numbers' })
  @Transform(({ value }): number[] =>
    Array.isArray(value) ? value.map((v: string) => parseFloat(v)) : [],
  )
  @IsNumber({}, { each: true })
  coordinates!: number[]; // [longitude, latitude]
}
export class OrderAddressDto {
  @IsString()
  @Length(1, 50)
  firsName!: string;

  @IsString()
  @Length(1, 50)
  lastName!: string;
  @IsOptional()
  @IsString()
  @Length(8, 20)
  phone!: string;

  @IsString()
  @IsOptional()
  @Length(1, 50)
  country!: string;
  @IsOptional()
  @IsString()
  @Length(1, 50)
  city!: string;
  @IsOptional()
  @Length(1, 50)
  @IsString()
  street!: string;
  @IsOptional()
  @IsString()
  @Length(1, 50)
  building!: string;

  @IsOptional()
  @IsString()
  @Length(4, 8)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  additionalInfo?: string;
  @IsOptional()
  @IsEnum(['home', 'office', 'other'])
  addressType!: 'home' | 'office' | 'other';

  @IsOptional()
  @IsString()
  @Length(0, 100)
  companyName?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => GeoLocationDto)
  location?: GeoLocationDto;
}
