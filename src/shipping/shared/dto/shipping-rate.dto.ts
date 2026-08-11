import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsEnum,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { ShippingRateScope } from '../schema/shipping-rate.schema';

interface HasScope {
  scope: ShippingRateScope;
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
            case ShippingRateScope.GLOBAL:
              return !dto.country && !dto.region && !dto.city;
            case ShippingRateScope.COUNTRY:
              return !!dto.country && !dto.region && !dto.city;
            case ShippingRateScope.REGION:
              return !!dto.country && !!dto.region && !dto.city;
            case ShippingRateScope.CITY:
              return !!dto.country && !!dto.region && !!dto.city;
            default:
              return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          const dto = args.object as HasScope;
          const scope = dto.scope;
          switch (scope) {
            case ShippingRateScope.GLOBAL:
              return 'scope=global must not include country, region, or city';
            case ShippingRateScope.COUNTRY:
              return 'scope=country requires countryId and must not include region or city';
            case ShippingRateScope.REGION:
              return 'scope=region requires countryId and regionId, and must not include city';
            case ShippingRateScope.CITY:
              return 'scope=city requires countryId, regionId, and cityId';
            default:
              return 'Invalid scope value';
          }
        },
      },
    });
  };
}

@IsScopeFieldsValid({
  message: 'The combination of scope and location fields is invalid.',
})
export class CreateShippingRateDto {
  @IsMongoId()
  @IsNotEmpty()
  @Exists(MODEL_NAMES.SHIPPING_PROVIDER)
  provider!: string;

  @IsEnum(ShippingRateScope)
  declare scope: ShippingRateScope;

  @IsOptional()
  @IsMongoId()
  @Exists(MODEL_NAMES.COUNTRY)
  country?: string;

  @IsOptional()
  @IsMongoId()
  @Exists(MODEL_NAMES.REGION)
  @ValidateIf(
    (dto: CreateShippingRateDto) =>
      dto.scope === ShippingRateScope.REGION ||
      dto.scope === ShippingRateScope.CITY,
  )
  region?: string;

  @IsOptional()
  @IsMongoId()
  @Exists(MODEL_NAMES.CITY)
  @ValidateIf(
    (dto: CreateShippingRateDto) => dto.scope === ShippingRateScope.CITY,
  )
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
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  freeShippingThreshold?: number;

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
