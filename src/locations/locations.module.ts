import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { AuthModule } from '../auth/auth.module';
import { Country, CountrySchema } from './shared/schema/country.schema';
import { Region, RegionSchema } from './shared/schema/region.schema';
import { City, CitySchema } from './shared/schema/city.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Country.name, schema: CountrySchema },
      { name: Region.name, schema: RegionSchema },
      { name: City.name, schema: CitySchema },
    ]),
    AuthModule,
  ],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService], // يستخدمه ShippingModule و CheckoutModule
})
export class LocationsModule {}
