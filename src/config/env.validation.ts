import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
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
  jwt_Access_hToken_secret!: string;

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
