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
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from './shared/schemas/payment-transaction.schema';
import { PaymentTransactionService } from './payment-transaction.service';
import { PaymentSchedulerService } from './payment-scheduler.service';
import { MoyasarProvider } from './providers/moyasar.provider';
import { HttpModule } from '@nestjs/axios';
import { Order, OrderSchema } from '../order/shared/schemas/Order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentMethod.name, schema: PaymentMethodSchema },
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    AuthModule,
    SettingsModule,
    HttpModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentTransactionService,
    PaymentSchedulerService,
    MoyasarProvider,
  ],
  exports: [PaymentsService, PaymentTransactionService],
})
export class PaymentsModule {}
