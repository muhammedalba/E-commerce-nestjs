import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from 'src/order/shared/schemas/Order.schema';
import { SettingsModule } from 'src/settings/settings.module';
import { InvoiceService } from './invoice.service';
import { PDF_RENDERER } from './renderers/pdf-renderer.interface';
import { TypstCliRenderer } from './renderers/typst-cli.renderer';
import { TypstNodeRenderer } from './renderers/typst-node.renderer';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';

/**
 * Tax invoice issuing. Kept free of the email and order modules (which use
 * it), so neither import becomes a cycle.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    SettingsModule,
  ],
  providers: [
    InvoiceService,
    {
      // typst-node (default): native binding; typst-cli: the typst executable
      provide: PDF_RENDERER,
      useFactory: () =>
        process.env.INVOICE_PDF_RENDERER === 'typst-cli'
          ? new TypstCliRenderer()
          : new TypstNodeRenderer(),
    },
  ],
  exports: [InvoiceService],
})
export class InvoiceModule {}
