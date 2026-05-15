import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsMongoId,
  Max,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';
import { Country } from 'src/locations/shared/schema/country.schema';

export class CreateTaxDto {
  @IsString()
  declare name: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  declare percentage: number;

  @IsMongoId()
  @Exists(Country.name)
  @IsOptional()
  declare country?: string;

  @IsString()
  @IsOptional()
  declare taxNumber?: string;

  @IsBoolean()
  @IsOptional()
  declare isIncludedInPrice?: boolean;

  @IsBoolean()
  @IsOptional()
  declare isActive?: boolean;

  @IsString()
  @IsOptional()
  declare description?: string;
}

export class UpdateTaxDto extends PartialType(CreateTaxDto) { }
