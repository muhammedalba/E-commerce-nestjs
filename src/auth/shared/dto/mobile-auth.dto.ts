import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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

/** Result of Sign in with Apple on the device. */
export class AppleMobileLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'identity_token is required' })
  @MaxLength(4096)
  identity_token!: string;

  // The raw nonce; the app passes its SHA-256 (hex) to Apple, which puts it
  // in the token. Only the app knows the raw value, so a stolen token
  // can't be replayed.
  @IsString()
  @MinLength(16, { message: 'nonce must be at least 16 characters' })
  @MaxLength(128)
  nonce!: string;

  // Apple sends the user's name to the app on the first sign-in only.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  full_name?: string;
}

/** Body of `DELETE auth/me`. */
export class DeleteAccountDto {
  // Required for email/password accounts; social accounts have none.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  password?: string;
}
