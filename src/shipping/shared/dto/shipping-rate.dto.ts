import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';
import { ShippingProvider } from '../schema/shipping-provider.schema';
import { Country } from 'src/locations/shared/schema/country.schema';
import { Region } from 'src/locations/shared/schema/region.schema';
import { City } from 'src/locations/shared/schema/city.schema';

export class CreateShippingRateDto {
  @IsMongoId()
  @IsNotEmpty()
  @Exists(ShippingProvider.name)
  provider!: string;

  @IsOptional()
  @IsMongoId()
  @Exists(Country.name)
  country?: string;

  @IsOptional()
  @IsMongoId()
  @Exists(Region.name)
  region?: string;

  @IsOptional()
  @IsMongoId()
  @Exists(City.name)
  city?: string;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  basePrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  baseWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  additionalKgPrice?: number;

  @IsOptional()
  @IsString()
  estimatedDays?: string;
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  supportsCOD?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateShippingRateDto extends PartialType(CreateShippingRateDto) {}
