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

export class CreateOrderDto {
  /*— file—*/
  @IsOptional()
  @IsString()
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
  totalQuantity?: number;

  /*— boolean —*/
  @IsOptional()
  @IsBoolean()
  isCheckedOut?: boolean;

  @IsOptional()
  @IsBoolean()
  isSavedForLater?: boolean;

  /*— Rationes Ordinis, Solutionis et Transportationis —*/
  @IsOptional()
  @IsEnum(['pending', 'processing', 'completed', 'cancelled'])
  status?: 'pending' | 'processing' | 'completed' | 'cancelled';

  @IsOptional()
  @IsEnum(['cash', 'creditCard', 'paypal'])
  paymentMethod?: 'cash' | 'creditCard' | 'paypal';

  @IsOptional()
  @IsEnum(['default', 'express', 'pickup'])
  shippingMethod?: 'default' | 'express' | 'pickup';

  @ValidateNested()
  @Type(() => OrderAddressDto)
  shippingAddress!: OrderAddressDto;

  /*— capons —*/
  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  /*— date —*/
  @IsOptional() @IsDate() @Type(() => Date) completedAt?: Date;
  @IsOptional() @IsDate() @Type(() => Date) cancelledAt?: Date;
  @IsOptional() @IsDate() @Type(() => Date) processingAt?: Date;
  @IsOptional() @IsDate() @Type(() => Date) checkedOutAt?: Date;
  @IsOptional() @IsDate() @Type(() => Date) savedForLaterAt?: Date;

  /*— Additional agri —*/
  @IsOptional() @IsBoolean() isDeleted?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() LocationOnMap?: string;
  @IsOptional() @IsString() deliveryDate?: string;
  @IsOptional() @IsString() deliveryName?: string;
  @IsOptional() @IsString() customerServiceContact?: string;
  @IsOptional() @IsString() paymentStatus?: string;
  @IsOptional() @IsString() DeliveryVerificationCode?: string;
}
