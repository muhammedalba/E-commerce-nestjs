import { Transform } from 'class-transformer';
import { IsJWT, IsNotEmpty, IsString } from 'class-validator';
export class RefreshTokenDto {
  @IsNotEmpty({ message: 'access token is required' })
  @IsString({ message: 'must be a string' })
  @Transform(({ value }: { value: string }) => value.toString().trim(), {
    toClassOnly: true,
  })
  @IsJWT()
  access_token!: string;
}
