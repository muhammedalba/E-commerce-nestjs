import { IsString, IsObject, IsOptional, IsBoolean } from 'class-validator';

/**
 * Moyasar webhook envelope. Every top-level field Moyasar sends must be
 * declared here: the global ValidationPipe uses `forbidNonWhitelisted`, so an
 * undeclared field rejects the whole delivery with 400.
 */
export class WebhookMoyasarDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  created_at?: string;

  /** Sent as `null` when the account has no display name. */
  @IsOptional()
  @IsString()
  account_name?: string | null;

  /** `false` for test-mode events. */
  @IsOptional()
  @IsBoolean()
  live?: boolean;

  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  secret_token?: string;
}
