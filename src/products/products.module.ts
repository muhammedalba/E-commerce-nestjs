import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { AuthModule } from 'src/auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantSchema,
} from './shared/schemas/ProductVariant.schema';

import { ProductsStatistics } from './products-helper/products-statistics.service';
import { AggregationSyncService } from './products-helper/aggregation-sync.service';

import {
  Supplier,
  SupplierSchema,
} from 'src/supplier/shared/schema/Supplier.schema';
import { Brand, BrandSchema } from 'src/brands/shared/schemas/brand.schema';
import {
  Category,
  CategorySchema,
} from 'src/categories/shared/schemas/category.schema';
import { OrderModule } from 'src/order/order.module';
import {
  SubCategory,
  SubCategorySchema,
} from 'src/sub-category/shared/schemas/sub-category.schema';
import { Role, RoleSchema } from 'src/roles/shared/schemas/role.schema';
import { BullModule } from '@nestjs/bullmq';

// â”€â”€â”€ New separated services â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { ProductQueryService } from './services/products-query.service';
import { ProductMutationService } from './services/products-mutation.service';
import { ProductFileService } from './services/products-file.service';
import { ProductSkuService } from './services/products-sku.service';
import { InventoryAlertService } from './services/inventory-alert.service';
import { InventoryEventListener } from './services/inventory-event.listener';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'mail-queue' }),
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: ProductVariant.name, schema: ProductVariantSchema },
      { name: Supplier.name, schema: SupplierSchema },
      { name: Brand.name, schema: BrandSchema },
      { name: Category.name, schema: CategorySchema },
      { name: SubCategory.name, schema: SubCategorySchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    AuthModule,
    OrderModule,
  ],
  controllers: [ProductsController],
  providers: [
    // Facade
    ProductsService,
    // Separated services
    ProductQueryService,
    ProductMutationService,
    ProductFileService,
    ProductSkuService,
    InventoryAlertService,
    InventoryEventListener,
    // Helpers
    ProductsStatistics,
    AggregationSyncService,
  ],
  exports: [MongooseModule, InventoryAlertService],
})
export class ProductsModule {}
