import { Module } from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Supplier, SupplierSchema } from './shared/schema/Supplier.schema';
import { AuthModule } from 'src/auth/auth.module';
import { SupplierStatistics } from './shared/Suppliers-helper/supplier-statistics.service';
import {
  Product,
  ProductSchema,
} from 'src/products/shared/schemas/Product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Supplier.name, schema: SupplierSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    AuthModule,
  ],

  controllers: [SupplierController],
  providers: [SupplierService, SupplierStatistics],
  exports: [MongooseModule],
})
export class SupplierModule {}
