import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsService } from './payments.service';
import {
  PaymentMethod,
  PaymentMethodSchema,
} from './shared/schema/payment-method.schema';
import { PaymentsController } from './payments.controller';
import { PaymentTransactionsController } from './payment-transactions.controller';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from './shared/schemas/payment-transaction.schema';
import { PaymentTransactionService } from './payment-transaction.service';
import { PaymentSchedulerService } from './payment-scheduler.service';
import { MoyasarProvider } from './providers/moyasar.provider';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { HttpModule } from '@nestjs/axios';
import { Order, OrderSchema } from '../order/shared/schemas/Order.schema';
import { Role, RoleSchema } from '../roles/shared/schemas/role.schema';
import { PaymentReviewListener } from './payment-review.listener';
import { PaymentRefundService } from './payment-refund.service';
import { PaymentRefundsController } from './payment-refunds.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentMethod.name, schema: PaymentMethodSchema },
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    AuthModule,
    SettingsModule,
    AuditModule,
    // Bounded so a hanging Moyasar call cannot hold webhook/verify requests open.
    HttpModule.register({ timeout: 10_000 }),
  ],
  controllers: [
    PaymentsController,
    PaymentTransactionsController,
    PaymentRefundsController,
  ],
  providers: [
    PaymentsService,
    PaymentTransactionService,
    PaymentSchedulerService,
    MoyasarProvider,
    PaymentProviderFactory,
    PaymentReviewListener,
    PaymentRefundService,
  ],
  exports: [PaymentsService, PaymentTransactionService],
})
export class PaymentsModule {}
