import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateShippingRateDto {
  @IsMongoId()
  @IsNotEmpty()
  provider!: string;

  @IsOptional()
  @IsMongoId()
  country?: string;

  @IsOptional()
  @IsMongoId()
  region?: string;

  @IsOptional()
  @IsMongoId()
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
