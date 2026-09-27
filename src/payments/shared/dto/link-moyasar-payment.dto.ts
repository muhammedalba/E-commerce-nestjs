import { IsMongoId, IsString, Matches, MaxLength } from 'class-validator';

/** Moyasar ids are interpolated into the Moyasar API path, so no '/' or '.'. */
export const MOYASAR_PAYMENT_ID_PATTERN = /^[\w-]+$/;

export class LinkMoyasarPaymentDto {
  @IsString()
  @MaxLength(64)
  @Matches(MOYASAR_PAYMENT_ID_PATTERN)
  paymentId!: string;
}

export class VerifyPaymentParamDto {
  /** The Moyasar payment id (named invoiceId for the existing route). */
  @IsString()
  @MaxLength(64)
  @Matches(MOYASAR_PAYMENT_ID_PATTERN)
  invoiceId!: string;
}

export class RetryPaymentParamDto {
  @IsMongoId()
  orderId!: string;
}
