import { Module } from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { FileUploadDiskStorageModule } from 'src/file-upload/file-upload.module';
import { Supplier, SupplierSchema } from './shared/schema/Supplier.schema';
import { AuthModule } from 'src/auth/auth.module';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { SupplierStatistics } from './shared/Suppliers-helper/supplier-statistics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Supplier.name, schema: SupplierSchema },
    ]),
    FileUploadDiskStorageModule,
    AuthModule,
  ],

  controllers: [SupplierController],
  providers: [SupplierService, CustomI18nService, SupplierStatistics],
  exports: [MongooseModule],
})
export class SupplierModule {}
