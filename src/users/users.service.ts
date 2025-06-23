import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { CreateUserDto } from './shared/dto/create-user.dto';
import { UpdateUserDto } from './shared/dto/update-user.dto';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { BaseService } from 'src/shared/utils/service/base.service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { IdParamDto } from './shared/dto/id-param.dto';
import { User, UserDocument } from 'src/auth/shared/schema/user.schema';
import { UsersStatistics } from './users-helper/users-statistics.service';

@Injectable()
export class UsersService extends BaseService<UserDocument> {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
    protected readonly usersStatistics: UsersStatistics,
  ) {
    super(userModel, i18n, fileUploadService);
  }
  async get_users_statistics() {
    await this.usersStatistics.users_statistics();
  }
  async createUser(
    CreateUserDto: CreateUserDto,
    file: MulterFileType,
  ): Promise<any> {
    return await this.createOneDoc(CreateUserDto, file, 'users', {
      fileFieldName: 'avatar',
      checkField: 'email',
      fieldValue: CreateUserDto.email,
    });
  }
  async getUsers(QueryString: QueryString): Promise<any> {
    return await this.findAllDoc('users', QueryString);
  }

  // async createMany(file: any) {
  //   const filesPath = await this.fileUploadService.saveFilesToDisk(
  //     file,
  //     './users',
  //   );
  //   return filesPath;
  // }

  async findOne(idParamDto: IdParamDto) {
    return await this.findOneDoc(idParamDto, '-__v');
  }

  async update_user(
    idParamDto: IdParamDto,
    UpdateUserDto: UpdateUserDto,
    file: MulterFileType,
  ): Promise<any> {
    // //1) check  user if found
    // const user = await this.userModel.findById(id).select('_id avatar');
    // if (!user) {
    //   throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    // }
    // //2) check if email already exists
    // if (UpdateUserDto.email) {
    //   const isExists = await this.userModel
    //     .exists({
    //       email: UpdateUserDto.email,
    //     })
    //     .lean();
    //   if (isExists) {
    //     throw new BadRequestException(
    //       this.i18n.translate('exception.EMAIL_EXISTS'),
    //     );
    //   }
    // }

    // // 3) update user avatar if new file is provided
    // if (file) {
    //   const destinationPath = `./${process.env.UPLOADS_FOLDER}/users`;
    //   const oldAvatarPath = `.${user.avatar}`;
    //   const avatarPath = await this.fileUploadService.updateFile(
    //     file,
    //     destinationPath,
    //     oldAvatarPath,
    //   );
    //   // 4) update user avatar
    //   UpdateUserDto.avatar = avatarPath;
    // }
    // // 5) update user in the database
    // const updatedUser = await this.userModel
    //   .findByIdAndUpdate(
    //     { _id: user._id },
    //     { $set: UpdateUserDto },
    //     { new: true, runValidators: true, upsert: true },
    //   )
    // .select('-__v');
    const selectedFields = '_id avatar email';
    return await this.updateOneDoc(
      idParamDto,
      UpdateUserDto,
      file,
      'users',
      selectedFields,
      {
        checkField: 'email',
        fieldValue: UpdateUserDto.email,
        fileFieldName: 'avatar',
      },
    );
  }

  async delete_user(idParamDto: IdParamDto): Promise<void> {
    return await this.deleteOneDoc(idParamDto, 'avatar');
  }
}
