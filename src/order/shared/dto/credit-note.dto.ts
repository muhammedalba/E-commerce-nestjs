import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreditNoteLineDto {
  /** The line's position in the order's items. */
  @IsInt()
  @Min(0)
  itemIndex!: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}

const REASON_TYPES = ['defect', 'other'] as const;
const REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;

/**
 * The lines a return would take and why (preview: nothing is saved).
 * `defect`: defect or store error, the store pays the shipping; `other`
 * (e.g. a change of mind): the customer pays it.
 */
export class PreviewCreditNoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreditNoteLineDto)
  lines!: CreditNoteLineDto[];

  @IsIn(REASON_TYPES)
  reasonType!: (typeof REASON_TYPES)[number];
}

export class CreateCreditNoteDto extends PreviewCreditNoteDto {
  /** Why the items come back; shown on the dashboard and in the audit log. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  /** Return the quantities to stock (default: yes). */
  @IsOptional()
  @IsBoolean()
  restock?: boolean;
}

export class CreditNoteParamDto {
  @IsMongoId()
  id!: string;

  @IsMongoId()
  noteId!: string;
}

/** The customer's return request: lines, reason and a description. */
export class CreateReturnRequestDto extends PreviewCreditNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note!: string;
}

/** An admin approves a request, optionally with other quantities. */
export class ApproveReturnRequestDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreditNoteLineDto)
  lines?: CreditNoteLineDto[];

  /** Return the quantities to stock (default: yes). */
  @IsOptional()
  @IsBoolean()
  restock?: boolean;
}

/** An admin rejects a request; the reason is emailed to the customer. */
export class RejectReturnRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class ReturnRequestParamDto {
  @IsMongoId()
  id!: string;

  @IsMongoId()
  requestId!: string;
}

/** The dashboard's list of return requests. */
export class ReturnRequestQueryDto {
  @IsOptional()
  @IsIn(REQUEST_STATUSES)
  status?: (typeof REQUEST_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
