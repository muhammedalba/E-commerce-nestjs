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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class GeoLocationDto {
  @ApiProperty({
    description: 'Type of the geographic point',
    example: 'Point',
  })
  @IsString()
  type?: 'Point';

  @ApiProperty({
    description: 'Coordinates [longitude, latitude]',
    example: [30.0, 31.0],
  })
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
  @ApiProperty({ description: 'First name of the recipient', example: 'John' })
  @IsString()
  @Length(1, 50)
  firsName!: string;

  @ApiProperty({ description: 'Last name of the recipient', example: 'Doe' })
  @IsString()
  @Length(1, 50)
  lastName!: string;

  @ApiPropertyOptional({
    description: 'Phone number of the recipient',
    example: '01234567890',
  })
  @IsOptional()
  @IsString()
  @Length(8, 20)
  phone!: string;

  @ApiPropertyOptional({
    description: 'Country of the shipping address',
    example: 'Egypt',
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  country!: string;

  @ApiPropertyOptional({
    description: 'City of the shipping address',
    example: 'Cairo',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  city!: string;

  @ApiPropertyOptional({
    description: 'Street of the shipping address',
    example: 'Nasr St.',
  })
  @IsOptional()
  @Length(1, 50)
  @IsString()
  street!: string;

  @ApiPropertyOptional({
    description: 'Building number or name',
    example: 'Building 10',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  building!: string;

  @ApiPropertyOptional({ description: 'Postal code', example: '12345' })
  @IsOptional()
  @IsString()
  @Length(4, 8)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Additional information for the address',
    example: 'Near the park',
  })
  @IsOptional()
  @IsString()
  @Length(0, 300)
  additionalInfo?: string;

  @ApiPropertyOptional({
    description: 'Type of address',
    enum: ['home', 'office', 'other'],
    example: 'home',
  })
  @IsOptional()
  @IsEnum(['home', 'office', 'other'])
  addressType!: 'home' | 'office' | 'other';

  @ApiPropertyOptional({
    description: 'Company name (if applicable)',
    example: 'ABC Corp',
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Geographic location coordinates',
    type: GeoLocationDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => GeoLocationDto)
  location?: GeoLocationDto;
}
