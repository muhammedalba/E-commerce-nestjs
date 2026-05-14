import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateShippingProviderDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsString()
  trackingUrl?: string;

  @IsOptional()
  logo?: any;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateShippingProviderDto extends PartialType(CreateShippingProviderDto) {}
