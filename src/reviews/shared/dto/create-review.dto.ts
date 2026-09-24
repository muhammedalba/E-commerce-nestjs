import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateReviewDto {
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.IS_INT') })
  @Min(1, { message: i18nValidationMessage('validation.RATING_RANGE') })
  @Max(5, { message: i18nValidationMessage('validation.RATING_RANGE') })
  rating!: number;

  @Transform(({ value }: TransformFnParams): unknown => {
    const raw: unknown = value;
    return typeof raw === 'string' ? raw.trim() : raw;
  })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @MinLength(3, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(1000, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  comment!: string;
}
