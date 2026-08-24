import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Coupon, CouponSchema } from './shared/Schemas/coupons.schema';
import { AuthModule } from 'src/auth/auth.module';

import { CouponHelperService } from './shared/coupon.helper';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Coupon.name, schema: CouponSchema }]),
    AuthModule,
  ],
  controllers: [CouponsController],
  providers: [CouponsService, CouponHelperService],
  exports: [CouponHelperService],
})
export class CouponsModule {}
