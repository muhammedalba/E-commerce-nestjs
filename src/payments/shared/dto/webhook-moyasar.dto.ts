import { IsString, IsObject, IsOptional } from 'class-validator';

export class WebhookMoyasarDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  secret_token?: string;
}
