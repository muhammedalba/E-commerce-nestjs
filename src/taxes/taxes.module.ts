import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaxesService } from './taxes.service';
import { TaxesController } from './taxes.controller';
import { Tax, TaxSchema } from './shared/schema/tax.schema';
import { Country, CountrySchema } from '../locations/shared/schema/country.schema';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';

import { FileUploadDiskStorageModule } from 'src/file-upload/file-upload.module';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tax.name, schema: TaxSchema },
      { name: Country.name, schema: CountrySchema }, // مطلوب للـ populate في findAll/findOne
    ]),
    AuthModule,
    SettingsModule,
    FileUploadDiskStorageModule,
  ],
  controllers: [TaxesController],
  providers: [TaxesService, CustomI18nService],
  exports: [TaxesService], // يستخدمه CheckoutModule
})
export class TaxesModule {}
