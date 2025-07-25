import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { MaxLength, Validate } from 'class-validator';
import { IsIdOrSlugConstraint } from 'src/shared/utils/validators/is-id-or-slug.validator';

export class IdParamDto {
  @ApiProperty({
    description: 'The ID or slug of the user.',
    example: '12345 or john-doe',
  })
  @Transform(({ value }: TransformFnParams) => {
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  @MaxLength(50, {
    message: 'id must be less than 50 characters',
  })
  @Validate(IsIdOrSlugConstraint)
  id!: string;
}
