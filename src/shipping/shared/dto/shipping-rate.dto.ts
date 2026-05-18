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
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

export class CreateShippingRateDto {
  @IsMongoId()
  @IsNotEmpty()
  @Exists(MODEL_NAMES.SHIPPING_PROVIDER)
  provider!: string;

  @IsOptional()
  @IsMongoId()
  @Exists(MODEL_NAMES.COUNTRY)
  country?: string;

  @IsOptional()
  @IsMongoId()
  @Exists(MODEL_NAMES.REGION)
  region?: string;

  @IsOptional()
  @IsMongoId()
  @Exists(MODEL_NAMES.CITY)
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
