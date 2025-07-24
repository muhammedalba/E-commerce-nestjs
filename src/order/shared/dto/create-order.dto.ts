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
import { ApiProperty } from '@nestjs/swagger';
import { OrderItemDto } from './order-item.dto';
import { OrderAddressDto } from './order‑address.dto';

export class CreateOrderDto {
  /*— file—*/
  @ApiProperty({
    description: 'Image of the transfer receipt',
    required: false,
  })
  @IsString()
  @IsOptional()
  transferReceiptImg?: string;

  @ApiProperty({ description: 'PDF of the invoice', required: false })
  @IsOptional()
  @IsString()
  InvoicePdf?: string;

  @ApiProperty({
    description: 'Image of the delivery receipt',
    required: false,
  })
  @IsOptional()
  @IsString()
  DeliveryReceiptImage?: string;

  /*— user—*/
  @ApiProperty({
    description: 'ID of the user associated with the order',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  @Type(() => String)
  user?: string;

  /*— order items —*/
  @ApiProperty({
    type: [OrderItemDto],
    description: 'List of items in the order',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  /*— Valores Financial —*/
  @ApiProperty({
    description: 'Total price of the order before discount',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPrice?: number;

  @ApiProperty({
    description: 'Total price of the order after discount',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPriceAfterDiscount?: number;

  @ApiProperty({
    description: 'Total quantity of items in the order',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalQuantity?: number;

  /*— boolean —*/
  @ApiProperty({
    description: 'Whether the order has been checked out',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isCheckedOut?: boolean;

  @ApiProperty({
    description: 'Whether the order is saved for later',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isSavedForLater?: boolean;

  /*— Rationes Ordinis, Solutionis et Transportationis —*/
  @ApiProperty({
    description: 'Current status of the order',
    enum: ['pending', 'processing', 'completed', 'cancelled'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['pending', 'processing', 'completed', 'cancelled'])
  status?: 'pending' | 'processing' | 'completed' | 'cancelled';

  @ApiProperty({
    description: 'Payment method used for the order',
    enum: ['cash', 'creditCard', 'paypal'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['cash', 'creditCard', 'paypal'])
  paymentMethod?: 'cash' | 'creditCard' | 'paypal';

  @ApiProperty({
    description: 'Shipping method for the order',
    enum: ['default', 'express', 'pickup'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['default', 'express', 'pickup'])
  shippingMethod?: 'default' | 'express' | 'pickup';

  @ApiProperty({
    type: OrderAddressDto,
    description: 'Shipping address for the order',
  })
  @ValidateNested()
  @Type(() => OrderAddressDto)
  shippingAddress!: OrderAddressDto;

  /*— capons —*/
  @ApiProperty({
    description: 'Coupon code applied to the order',
    required: false,
  })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiProperty({
    description: 'Discount amount applied by coupon',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  /*— date —*/
  @ApiProperty({
    description: 'Date when the order was completed',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  completedAt?: Date;
  @ApiProperty({
    description: 'Date when the order was cancelled',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  cancelledAt?: Date;
  @ApiProperty({
    description: 'Date when the order started processing',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  processingAt?: Date;
  @ApiProperty({
    description: 'Date when the order was checked out',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  checkedOutAt?: Date;
  @ApiProperty({
    description: 'Date when the order was saved for later',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  savedForLaterAt?: Date;

  /*— Additional agri —*/
  @ApiProperty({
    description: 'Whether the order is marked as deleted',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
  @ApiProperty({
    description: 'Additional notes for the order',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
  @ApiProperty({ description: 'Location of the order on map', required: false })
  @IsOptional()
  @IsString()
  LocationOnMap?: string;
  @ApiProperty({ description: 'Expected delivery date', required: false })
  @IsOptional()
  @IsString()
  deliveryDate?: string;
  @ApiProperty({ description: 'Name of the delivery person', required: false })
  @IsOptional()
  @IsString()
  deliveryName?: string;
  @ApiProperty({
    description: 'Contact information for customer service',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerServiceContact?: string;
  @ApiProperty({ description: 'Status of the payment', required: false })
  @IsOptional()
  @IsString()
  paymentStatus?: string;
  @ApiProperty({
    description: 'Verification code for delivery',
    required: false,
  })
  @IsOptional()
  @IsString()
  DeliveryVerificationCode?: string;
}
