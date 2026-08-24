import { Module } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Brand, BrandSchema } from './shared/schemas/brand.schema';

import { AuthModule } from 'src/auth/auth.module';
import { BrandsStatistics } from './shared/brands-helper/brands-statistics.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Brand.name, schema: BrandSchema }]),
    AuthModule,
  ],
  controllers: [BrandsController],
  providers: [BrandsService, BrandsStatistics],
  exports: [MongooseModule],
})
export class BrandsModule {}
