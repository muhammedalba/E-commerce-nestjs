import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class resetCodeDto {
  @IsNotEmpty({
    message: 'reset code is required',
  })
  @IsString({
    message: 'reset code must be a string',
  })
  @Length(6, 6, { message: 'reset code must be 6 characters long' })
  @Transform(({ value }: { value: string }) => value.trim(), {
    toClassOnly: true,
  })
  resetCode!: string;
}
