import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Coupon, CouponSchema } from './shared/Schemas/coupons.schema';
import { FileUploadDiskStorageModule } from 'src/file-upload-in-diskStorage/file-upload.module';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Coupon.name, schema: CouponSchema }]),
    FileUploadDiskStorageModule,
    AuthModule,
  ],
  controllers: [CouponsController],
  providers: [CouponsService, CustomI18nService],
})
export class CouponsModule {}
