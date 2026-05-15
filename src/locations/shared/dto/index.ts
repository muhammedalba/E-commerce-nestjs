import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsMongoId,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { Country } from '../schema/country.schema';
import { Region } from '../schema/region.schema';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';

// ===========================================================================
// COUNTRY DTOs
// ===========================================================================

export class CreateCountryDto {
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  name!: FieldLocalizeDto;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsOptional()
  phoneCode?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCountryDto extends PartialType(CreateCountryDto) {}

// ===========================================================================
// REGION DTOs
// ===========================================================================

export class CreateRegionDto {
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  name!: FieldLocalizeDto;

  @IsMongoId()
  @Exists(Country.name)
  country!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateRegionDto extends PartialType(CreateRegionDto) {}

// ===========================================================================
// CITY DTOs
// ===========================================================================

export class CreateCityDto {
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  name!: FieldLocalizeDto;

  @IsMongoId()
  @Exists(Country.name)
  country!: string;

  @IsMongoId()
  @Exists(Region.name)
  region!: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsBoolean()
  @IsOptional()
  isDeliveryAvailable?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCityDto extends PartialType(CreateCityDto) {}
