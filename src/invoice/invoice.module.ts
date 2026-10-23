import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from 'src/order/shared/schemas/Order.schema';
import {
  Coupon,
  CouponSchema,
} from 'src/coupons/shared/Schemas/coupons.schema';
import { SettingsModule } from 'src/settings/settings.module';
import { User, UserSchema } from 'src/auth/shared/schema/user.schema';
import { InvoiceQueryService } from './invoice-query.service';
import { CreditNoteService } from './credit-note.service';
import { InvoiceService } from './invoice.service';
import { PDF_RENDERER } from './renderers/pdf-renderer.interface';
import { TypstCliRenderer } from './renderers/typst-cli.renderer';
import { TypstNodeRenderer } from './renderers/typst-node.renderer';
import { CreditNote, CreditNoteSchema } from './schemas/credit-note.schema';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';

/**
 * Tax invoices and credit notes. Kept free of the email and order modules
 * (which use it), so neither import becomes a cycle.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: CreditNote.name, schema: CreditNoteSchema },
      { name: Order.name, schema: OrderSchema },
      // Read-only: older orders' coupon rules (credit note discounts)
      { name: Coupon.name, schema: CouponSchema },
      // Read-only: the dashboard's search by customer email or phone
      { name: User.name, schema: UserSchema },
    ]),
    SettingsModule,
  ],
  providers: [
    InvoiceService,
    CreditNoteService,
    InvoiceQueryService,
    {
      // typst-node (default): native binding; typst-cli: the typst executable
      provide: PDF_RENDERER,
      useFactory: () =>
        process.env.INVOICE_PDF_RENDERER === 'typst-cli'
          ? new TypstCliRenderer()
          : new TypstNodeRenderer(),
    },
  ],
  exports: [InvoiceService, CreditNoteService, InvoiceQueryService],
})
export class InvoiceModule {}
