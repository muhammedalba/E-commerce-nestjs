import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class OrderAddressDto {
  @IsString()
  @Length(1, 50)
  firsName!: string;

  @IsString()
  @Length(1, 50)
  lastName!: string;

  @IsString()
  @Length(8, 20)
  phone!: string;

  @IsString()
  @Length(1, 50)
  country!: string;

  @IsString()
  @Length(1, 50)
  city!: string;

  @Length(1, 50)
  @IsString()
  street!: string;

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

  @IsEnum(['home', 'office', 'other'])
  addressType!: 'home' | 'office' | 'other';

  @IsOptional()
  @IsString()
  @Length(0, 100)
  companyName?: string;
}
