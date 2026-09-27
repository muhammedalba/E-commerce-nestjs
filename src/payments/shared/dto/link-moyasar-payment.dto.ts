import { IsString, Matches, MaxLength } from 'class-validator';

export class LinkMoyasarPaymentDto {
  /** Moyasar payment id; interpolated into the Moyasar API path, so no '/' or '.'. */
  @IsString()
  @MaxLength(64)
  @Matches(/^[\w-]+$/)
  paymentId!: string;
}
