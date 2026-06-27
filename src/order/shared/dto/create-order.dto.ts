// src/order/dto/create‑order.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderItemDto } from './order-item.dto';
import { OrderAddressDto } from './order‑address.dto';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentStatus } from 'src/payments/shared/enums/payment-status.enum';

export class CreateOrderDto {
  /*— file—*/
  @IsString()
  @IsOptional()
  transferReceiptImg?: string;

  @IsOptional()
  @IsString()
  InvoicePdf?: string;

  @IsOptional()
  @IsString()
  DeliveryReceiptImage?: string;

  /*— user—*/
  @IsOptional()
  @IsMongoId()
  @Exists(MODEL_NAMES.USER)
  @Type(() => String)
  user?: string;

  /*— order items —*/
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  /*— Valores Financial —*/
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPriceAfterDiscount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paymentFees?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  grandTotal?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  /*— boolean —*/
  @IsOptional()
  @IsBoolean()
  isCheckedOut?: boolean;

  @IsOptional()
  @IsBoolean()
  isSavedForLater?: boolean;

  /*— Rationes Ordinis, Solutionis et Transportationis —*/
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  // --- Legacy Fields ---
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  shippingMethod?: string;
  // ---------------------

  @ValidateNested()
  @Type(() => OrderAddressDto)
  shippingAddress!: OrderAddressDto;

  @IsMongoId()
  @Exists(MODEL_NAMES.SHIPPING_PROVIDER)
  @Type(() => String)
  shippingProviderId!: string;

  @IsMongoId()
  @Exists(MODEL_NAMES.SHIPPING_RATE)
  @Type(() => String)
  shippingRateId!: string;

  @IsOptional()
  @IsMongoId()
  @Exists(MODEL_NAMES.PAYMENT_METHOD)
  @Type(() => String)
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  paymentMethodCode?: string;

  /*— capons —*/
  @IsOptional()
  @IsMongoId()
  @Exists(MODEL_NAMES.COUPON)
  @Type(() => String)
  couponId?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  /*— date —*/
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  completedAt?: Date;
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  cancelledAt?: Date;
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  processingAt?: Date;
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  checkedOutAt?: Date;
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  savedForLaterAt?: Date;

  /*— Additional agri —*/
  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
  @IsOptional()
  @IsString()
  notes?: string;
  @IsOptional()
  @IsString()
  LocationOnMap?: string;
  @IsOptional()
  @IsString()
  deliveryDate?: string;
  @IsOptional()
  @IsString()
  deliveryName?: string;
  @IsOptional()
  @IsString()
  customerServiceContact?: string;
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
  @IsOptional()
  @IsString()
  DeliveryVerificationCode?: string;
}
