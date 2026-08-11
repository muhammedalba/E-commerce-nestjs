import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsMongoId,
  IsEnum,
  Max,
  Min,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { TaxScope } from '../schema/tax.schema';

// ─────────────────────────────────────────────────────────────────────────────
// Custom cross-field validator: enforce scope ↔ field constraints
// ─────────────────────────────────────────────────────────────────────────────

interface HasScope {
  scope: TaxScope;
  country?: string;
  region?: string;
  city?: string;
}

function IsScopeFieldsValid(validationOptions?: ValidationOptions) {
  return function (target: Function) {
    registerDecorator({
      name: 'isScopeFieldsValid',
      target,
      propertyName: '',
      options: validationOptions,
      validator: {
        validate(_value: any, args: ValidationArguments) {
          const dto = args.object as HasScope;
          const scope = dto.scope;

          switch (scope) {
            case TaxScope.GLOBAL:
              return !dto.country && !dto.region && !dto.city;

            case TaxScope.COUNTRY:
              return !!dto.country && !dto.region && !dto.city;

            case TaxScope.REGION:
              return !!dto.country && !!dto.region && !dto.city;

            case TaxScope.CITY:
              return !!dto.country && !!dto.region && !!dto.city;

            default:
              return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          const dto = args.object as HasScope;
          const scope = dto.scope;
          switch (scope) {
            case TaxScope.GLOBAL:
              return 'scope=global must not include country, region, or city';
            case TaxScope.COUNTRY:
              return 'scope=country requires countryId and must not include region or city';
            case TaxScope.REGION:
              return 'scope=region requires countryId and regionId, and must not include city';
            case TaxScope.CITY:
              return 'scope=city requires countryId, regionId, and cityId';
            default:
              return 'Invalid scope value';
          }
        },
      },
    });
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateTaxDto
// ─────────────────────────────────────────────────────────────────────────────

@IsScopeFieldsValid({
  message: 'The combination of scope and location fields is invalid.',
})
export class CreateTaxDto {
  // ── Existing fields (unchanged) ───────────────────────────────────────────

  @IsString()
  declare name: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  declare percentage: number;

  /**
   * Required when scope = 'country' | 'region' | 'city'.
   * Must be absent (null / omitted) when scope = 'global'.
   */
  @IsMongoId()
  @Exists(MODEL_NAMES.COUNTRY)
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

  // ── New fields ────────────────────────────────────────────────────────────

  /**
   * Explicit scope of the tax rule.
   * Required on every new tax. Validated via cross-field decorator below.
   */
  @IsEnum(TaxScope)
  declare scope: TaxScope;

  /**
   * Required when scope = 'region' | 'city'.
   * Must belong to `country` (checked in service layer).
   */
  @IsMongoId()
  @Exists(MODEL_NAMES.REGION)
  @ValidateIf(
    (dto: CreateTaxDto) =>
      dto.scope === TaxScope.REGION || dto.scope === TaxScope.CITY,
  )
  @IsOptional()
  declare region?: string;

  /**
   * Required when scope = 'city'.
   * Must belong to `region` (checked in service layer).
   */
  @IsMongoId()
  @Exists(MODEL_NAMES.CITY)
  @ValidateIf((dto: CreateTaxDto) => dto.scope === TaxScope.CITY)
  @IsOptional()
  declare city?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UpdateTaxDto — all fields optional (PartialType does this automatically)
// The cross-field validation is skipped on update because partial updates
// (e.g. only toggling isActive) must not be forced to re-supply scope.
// Full scope+location updates should supply all relevant fields together.
// ─────────────────────────────────────────────────────────────────────────────

export class UpdateTaxDto extends PartialType(CreateTaxDto) {}
