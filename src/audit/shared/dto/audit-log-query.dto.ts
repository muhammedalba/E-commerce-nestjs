import { Transform, Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AUDIT_MAX_PAGE_LIMIT } from '../audit.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Query of `GET /audit-logs`; every filter is optional. */
export class AuditLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AUDIT_MAX_PAGE_LIMIT)
  limit?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  module?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  action?: string;

  @IsOptional()
  @IsMongoId()
  userId?: string;

  /** Case-insensitive "starts with" match on the actor's email. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  userEmail?: string;

  /** Inclusive lower bound on `createdAt` (ISO 8601). */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Inclusive upper bound on `createdAt` (ISO 8601). */
  @IsOptional()
  @IsISO8601()
  to?: string;
}
