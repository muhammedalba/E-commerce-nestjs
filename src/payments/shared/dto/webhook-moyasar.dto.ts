import { IsString, IsObject, IsOptional } from 'class-validator';

export class WebhookMoyasarDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsObject()
  data: any;

  @IsOptional()
  @IsObject()
  metadata?: any;
}
