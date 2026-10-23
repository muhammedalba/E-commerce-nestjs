import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Search, issue-date range and paging, shared by both lists. */
class DocumentQueryDto {
  /** Number, customer name, order number, customer email or phone. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** ISO date-time: issued from (inclusive). */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  /** ISO date-time: issued until (inclusive). */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class InvoiceQueryDto extends DocumentQueryDto {
  /** `generated`: issued; `failed`: not issued (to retry). */
  @IsOptional()
  @IsIn(['generated', 'failed'])
  status?: 'generated' | 'failed';
}

export class CreditNoteQueryDto extends DocumentQueryDto {
  @IsOptional()
  @IsIn(['defect', 'other'])
  reasonType?: 'defect' | 'other';

  /** Issued (default) or still awaiting its refund. */
  @IsOptional()
  @IsIn(['issued', 'awaiting_refund'])
  state?: 'issued' | 'awaiting_refund';
}

/** The CSV export: which list, with that list's filters. */
export class ExportQueryDto extends DocumentQueryDto {
  @IsIn(['invoices', 'credit-notes'])
  type!: 'invoices' | 'credit-notes';

  @IsOptional()
  @IsIn(['generated', 'failed'])
  status?: 'generated' | 'failed';

  @IsOptional()
  @IsIn(['defect', 'other'])
  reasonType?: 'defect' | 'other';

  @IsOptional()
  @IsIn(['issued', 'awaiting_refund'])
  state?: 'issued' | 'awaiting_refund';
}

export class OrderIdParamDto {
  @IsMongoId()
  orderId!: string;
}

export class NoteIdParamDto {
  @IsMongoId()
  noteId!: string;
}
