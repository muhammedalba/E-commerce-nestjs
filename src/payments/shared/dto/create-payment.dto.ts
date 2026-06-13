import { IsEnum, IsMongoId, IsNumber, IsString } from 'class-validator';
import { PaymentProvider } from '../enums/payment-provider.enum';

export class CreatePaymentDto {
  @IsMongoId()
  orderId!: string;

  @IsMongoId()
  userId!: string;

  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;
}
