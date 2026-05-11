import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { AuthModule } from '../auth/auth.module';
import {
  ShippingProvider,
  ShippingProviderSchema,
} from './shared/schema/shipping-provider.schema';
import {
  ShippingRate,
  ShippingRateSchema,
} from './shared/schema/shipping-rate.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShippingProvider.name, schema: ShippingProviderSchema },
      { name: ShippingRate.name, schema: ShippingRateSchema },
    ]),
    AuthModule,
  ],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService], // يستخدمه CheckoutModule
})
export class ShippingModule {}
