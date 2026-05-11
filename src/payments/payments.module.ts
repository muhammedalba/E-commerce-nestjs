import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsService } from './payments.service';
import {
  PaymentMethod,
  PaymentMethodSchema,
} from './shared/schema/payment-method.schema';
import { PaymentsController } from './payments.controller';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentMethod.name, schema: PaymentMethodSchema },
    ]),
    AuthModule,
    SettingsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService], // يستخدمه CheckoutModule
})
export class PaymentsModule {}
