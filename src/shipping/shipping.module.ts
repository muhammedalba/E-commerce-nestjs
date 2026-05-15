import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShippingService } from './shipping.service';
import { ShippingRatesService } from './shipping-rates.service';
import { ShippingController } from './shipping.controller';
import { AuthModule } from '../auth/auth.module';
import { FileUploadDiskStorageModule } from 'src/file-upload/file-upload.module';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
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
    FileUploadDiskStorageModule,
  ],
  controllers: [ShippingController],
  providers: [ShippingService, ShippingRatesService, CustomI18nService],
  exports: [ShippingService, ShippingRatesService], // يستخدمه CheckoutModule
})
export class ShippingModule {}
