import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  IsUrl,
  IsEnum,
} from 'class-validator';
export enum Status {
  Inactive = 'inactive',
  Active = 'active',
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({ description: 'Name of the supplier', example: 'Supplier A' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Slug for the supplier (auto-generated if not provided)',
    example: 'supplier-a',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: 'Contact person', example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({
    description: 'Phone number of the supplier',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Email address of the supplier',
    example: 'info@supplier-a.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Physical address of the supplier',
    example: '123 Main St, Anytown',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Website URL of the supplier',
    example: 'https://www.supplier-a.com',
  })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({
    description: 'Status of the supplier',
    enum: Status,
    example: Status.Active,
  })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}
