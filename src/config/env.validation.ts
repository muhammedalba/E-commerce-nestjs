import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 4000;

  @IsString()
  MONGODB_URI!: string;

  @IsString()
  BASE_URL!: string;

  @IsString()
  CLIENT_URL!: string;

  @IsString()
  JWT_SECRET_KEY!: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRE_TIME: string = '1d';

  @IsString()
  @IsOptional()
  JWT_REFRESH_TOKEN_EXPIRE_TIME: string = '7';

  @IsString()
  @IsOptional()
  LANGUAGES: string = 'ar,en';

  @IsString()
  @IsOptional()
  DEFAULT_LANGUAGE: string = 'ar';

  @IsString()
  MAIL_HOST!: string;
  @IsNumber()
  MAIL_PORT!: number;
  @IsEmail()
  MAIL_USERNAME!: string;
  @IsString()
  MAIL_PASSWORD!: string;
  @IsEmail()
  MAIL_FROM_ADDRESS!: string;
  @IsEmail()
  ADMIN_EMAIL!: string;
  @IsUrl({ require_tld: false }) // require_tld: false للسماح بـ localhost
  SUPPORT_LINK!: string;
  @IsUrl({ require_tld: false })
  LOGIN_LINK!: string;

  @IsString()
  REDIS_URL!: string;

  @IsNumber()
  MAIL_RETRY_ATTEMPTS!: number;

  @IsNumber()
  MAIL_RETRY_DELAY!: number;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
