import { Module } from '@nestjs/common';

import { LocationsModule } from '../locations/locations.module';
import { ShippingModule } from '../shipping/shipping.module';
import { TaxesModule } from '../taxes/taxes.module';
import { PaymentsModule } from '../payments/payments.module';
import { SettingsModule } from '../settings/settings.module';
import { AuditModule } from '../audit/audit.module';
import { CouponsModule } from '../coupons/coupons.module';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { CheckoutSessionService } from './checkout-session.service';
import { CheckoutOrchestratorService } from './checkout-orchestrator.service';

@Module({
  imports: [
    LocationsModule,
    ShippingModule,
    TaxesModule,
    PaymentsModule,
    SettingsModule,
    AuditModule,
    CouponsModule,
    AuthModule,
    CartModule,
    // Checkout sessions live in Redis (RedisModule, global); no local cache.
    // سنحتاج لاحقاً لربطه بـ OrdersModule و ProductsModule
  ],
  controllers: [CheckoutController],
  providers: [
    CheckoutService,
    CheckoutSessionService,
    CheckoutOrchestratorService,
  ],
  exports: [
    CheckoutService,
    CheckoutSessionService,
    CheckoutOrchestratorService,
  ],
})
export class CheckoutModule {}
