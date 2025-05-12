import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { AuthModule } from 'src/auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { FileUploadDiskStorageModule } from 'src/file-upload-in-diskStorage/file-upload.module';
import { Product, ProductSchema } from './shared/schemas/Product.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import * as mongooseI18n from 'mongoose-i18n-localize';
@Module({
  imports: [
    FileUploadDiskStorageModule,
    MongooseModule.forFeatureAsync([
      {
        name: Product.name,
        useFactory() {
          const schema = ProductSchema;
          schema.plugin(mongooseI18n, {
            locales: process.env.LANGUAGES?.split(',') ?? ['ar', 'en'],
            defaultLocale: process.env.DEFAULT_LANGUAGE ?? 'ar',
            textCase: 'lowercase',
            autoPopulate: true,
            indexes: {
              title: 1,
              slug: 1,
            },
          });
          return schema;
        },
      },
    ]),
    AuthModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, CustomI18nService],
})
export class ProductsModule {}
