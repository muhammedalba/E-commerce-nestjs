import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaxesService } from './taxes.service';
import { TaxesController } from './taxes.controller';
import { Tax, TaxSchema } from './shared/schema/tax.schema';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tax.name, schema: TaxSchema }]),
    AuthModule,
    SettingsModule,
  ],
  controllers: [TaxesController],
  providers: [TaxesService],
  exports: [TaxesService], // يستخدمه CheckoutModule
})
export class TaxesModule {}
