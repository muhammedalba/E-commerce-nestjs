import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  ValidateNested,
  IsBoolean,
  IsEnum,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MeasurementUnit } from '../schemas/ProductVariant.schema';
import { PackageType } from '../schemas/shipping-profile.schema';

// ─── Shipping Dimensions DTO ─────────────────────────────
export class ShippingDimensionsDto {
  @IsNumber()
  @IsOptional()
  @Min(0.1, { message: 'lengthMm must be greater than 0' })
  @Type(() => Number)
  lengthMm?: number;

  @IsNumber()
  @IsOptional()
  @Min(0.1, { message: 'widthMm must be greater than 0' })
  @Type(() => Number)
  widthMm?: number;

  @IsNumber()
  @IsOptional()
  @Min(0.1, { message: 'heightMm must be greater than 0' })
  @Type(() => Number)
  heightMm?: number;
}

// ─── Shipping Profile DTO ────────────────────────────────
export class ShippingProfileDto {
  @IsNumber()
  @IsNotEmpty({
    message: 'weightGrams is required when shippingProfile is provided',
  })
  @Min(0.1, { message: 'weightGrams must be greater than 0' })
  @Type(() => Number)
  weightGrams!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingDimensionsDto)
  dimensions?: ShippingDimensionsDto;

  @IsEnum(PackageType, { message: 'Invalid packageType' })
  @IsOptional()
  packageType?: PackageType;

  @IsNumber()
  @IsOptional()
  @Min(1, { message: 'quantityPerPackage must be at least 1' })
  @Type(() => Number)
  quantityPerPackage?: number;
}

// ─── Component DTO (for A+B products) ────────────────────
export class VariantComponentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  value!: number;

  @IsEnum(MeasurementUnit)
  @IsNotEmpty()
  unit!: string;
}

// ─── Measured Attribute DTO ──────────────────────────────
export class MeasuredAttributeDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  value!: number;

  @IsEnum(MeasurementUnit)
  @IsNotEmpty()
  unit!: string;
}

// ─── Custom Validators ───────────────────────────────────
@ValidatorConstraint({ name: 'isLessThanPrice', async: false })
export class IsLessThanPriceConstraint implements ValidatorConstraintInterface {
  validate(priceAfterDiscount: number, args: ValidationArguments) {
    const object = args.object as { price?: number };
    if (object.price === undefined || object.price === null) return true; // Ignored if price is not provided
    return (
      typeof priceAfterDiscount === 'number' &&
      typeof object.price === 'number' &&
      priceAfterDiscount < object.price
    );
  }

  defaultMessage(args: ValidationArguments) {
    return `Price after discount must be strictly less than the original price ${args.value}`;
  }
}

// ─── Create Variant DTO ──────────────────────────────────
export class CreateVariantDto {
  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Price is required' })
  @Min(0)
  @Max(200000)
  @Type(() => Number)
  price!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(200000)
  @Type(() => Number)
  // Ensures priceAfterDiscount is less than price
  @Validate(IsLessThanPriceConstraint)
  priceAfterDiscount?: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Type(() => Number)
  stock!: number;

  @IsOptional()
  attributes?: Record<string, unknown>;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => VariantComponentDto)
  components?: VariantComponentDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingProfileDto)
  shippingProfile?: ShippingProfileDto;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  image?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}

// ─── Update Variant DTO ──────────────────────────────────
export class UpdateVariantDto {
  @IsString()
  @IsNotEmpty()
  _id!: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(200000)
  @Type(() => Number)
  price?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(200000)
  @Type(() => Number)
  @Validate(IsLessThanPriceConstraint)
  priceAfterDiscount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  stock?: number;

  @IsOptional()
  attributes?: Record<string, unknown>;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => VariantComponentDto)
  components?: VariantComponentDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingProfileDto)
  shippingProfile?: ShippingProfileDto;

  @IsString()
  @IsOptional()
  label?: string;
  @IsString()
  @IsOptional()
  image?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}

// ─── Variant Operations (for PATCH endpoint) ─────────────
export class VariantOperationsDto {
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  create?: CreateVariantDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateVariantDto)
  update?: UpdateVariantDto[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  delete?: string[];
}
