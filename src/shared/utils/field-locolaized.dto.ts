import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class FieldLocalizeDto {
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @IsString({ message: 'validation.NOT_EMPTY' })
  @Transform(({ value }: TransformFnParams) => {
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  ar!: string;
  @IsString({ message: 'validation.NOT_EMPTY' })
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @Transform(({ value }: TransformFnParams) => {
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  en!: string;
}
