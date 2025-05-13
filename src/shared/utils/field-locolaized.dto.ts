import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class FieldLocalizeDto {
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @IsString({ message: 'validation.NOT_EMPTY' })
  @Length(3, 70, {
    message: 'validation.LANG_CODE_LENGTH',
  })
  @Transform(({ value }: TransformFnParams) => {
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  ar!: string;
  @IsString({ message: 'validation.NOT_EMPTY' })
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @Transform(({ value }: TransformFnParams) => {
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  @Length(3, 70, {
    message: 'validation.LANG_CODE_LENGTH',
  })
  en!: string;
}
