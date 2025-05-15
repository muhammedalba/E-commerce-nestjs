import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { Cart, CartSchema } from './shared/schemas/cart.schema';
import { AuthModule } from 'src/auth/auth.module';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
// import { FileUploadDiskStorageModule } from 'src/file-upload-in-diskStorage/file-upload.module';

@Module({
  imports: [
    AuthModule,
    // FileUploadDiskStorageModule,
    MongooseModule.forFeature([{ name: Cart.name, schema: CartSchema }]),
  ],
  controllers: [CartController],
  providers: [CartService, CustomI18nService],
  exports: [CartService],
})
export class CartModule {}
