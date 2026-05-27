import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { AuthModule } from 'src/auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { FileUploadDiskStorageModule } from 'src/file-upload/file-upload.module';
import { Product, ProductSchema } from './shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantSchema,
} from './shared/schemas/ProductVariant.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

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
    FileUploadDiskStorageModule,
    BullModule.registerQueue({ name: 'mail-queue' }),
    MongooseModule.forFeatureAsync([
      {
        name: Product.name,
        useFactory() {
          return ProductSchema;
        },
      },
      {
        name: ProductVariant.name,
        useFactory: () => {
          return ProductVariantSchema;
        },
      },
      {
        name: Supplier.name,
        useFactory: () => {
          return SupplierSchema;
        },
      },
      {
        name: Brand.name,
        useFactory: () => {
          return BrandSchema;
        },
      },
      {
        name: Category.name,
        useFactory: () => {
          return CategorySchema;
        },
      },
      {
        name: SubCategory.name,
        useFactory: () => {
          return SubCategorySchema;
        },
      },
      {
        name: Role.name,
        useFactory: () => {
          return RoleSchema;
        },
      },
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
    CustomI18nService,
    ProductsStatistics,
    AggregationSyncService,
  ],
  exports: [MongooseModule, InventoryAlertService],
})
export class ProductsModule {}
