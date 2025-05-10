import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FileUploadDiskStorageModule } from 'src/file-upload-in-diskStorage/file-upload.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema, User } from 'src/users/shared/schemas/user.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';

@Module({
  imports: [
    FileUploadDiskStorageModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController],
  providers: [UsersService, CustomI18nService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
