import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class ReplyReviewDto {
  @Transform(({ value }: TransformFnParams): unknown => {
    const raw: unknown = value;
    return typeof raw === 'string' ? raw.trim() : raw;
  })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @MaxLength(1000, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  text!: string;
}
