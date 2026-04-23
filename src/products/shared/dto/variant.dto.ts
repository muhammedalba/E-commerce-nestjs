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
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MeasurementUnit } from '../schemas/ProductVariant.schema';

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
    const object = args.object as any;
    if (object.price === undefined || object.price === null) return true; // Ignored if price is not provided
    return (
      typeof priceAfterDiscount === 'number' &&
      typeof object.price === 'number' &&
      priceAfterDiscount < object.price
    );
  }

  defaultMessage(args: ValidationArguments) {
    return 'Price after discount must be strictly less than the original price';
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
