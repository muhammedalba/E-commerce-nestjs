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

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;
  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}
