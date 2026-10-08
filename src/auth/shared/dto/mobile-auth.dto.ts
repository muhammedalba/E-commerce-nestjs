import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body of `POST auth/refresh-token` (mobile clients; browsers use the cookie). */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'refresh_token is required' })
  @MaxLength(100)
  refresh_token!: string;
}

/** ID token returned by the Google Sign-In SDK on the device. */
export class GoogleMobileLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'id_token is required' })
  @MaxLength(4096)
  id_token!: string;
}

/** User access token returned by the Facebook Login SDK on the device. */
export class FacebookMobileLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'access_token is required' })
  @MaxLength(1024)
  access_token!: string;
}
