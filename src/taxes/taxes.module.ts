import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaxesService } from './taxes.service';
import { TaxesController } from './taxes.controller';
import { Tax, TaxSchema } from './shared/schema/tax.schema';
import {
  Country,
  CountrySchema,
} from '../locations/shared/schema/country.schema';
import { Region, RegionSchema } from '../locations/shared/schema/region.schema';
import { City, CitySchema } from '../locations/shared/schema/city.schema';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tax.name, schema: TaxSchema },
      { name: Country.name, schema: CountrySchema }, // مطلوب للـ populate في findAll/findOne
      { name: Region.name, schema: RegionSchema },
      { name: City.name, schema: CitySchema },
    ]),
    AuthModule,
    SettingsModule,
  ],
  controllers: [TaxesController],
  providers: [TaxesService],
  exports: [TaxesService], // يستخدمه CheckoutModule
})
export class TaxesModule {}
