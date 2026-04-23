import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { CreateUserDto } from './shared/dto/create-user.dto';
import { UpdateUserDto } from './shared/dto/update-user.dto';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { BaseService } from 'src/shared/utils/service/base.service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
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
    return await this.usersStatistics.users_statistics();
  }
  async createUser(
    CreateUserDto: CreateUserDto,
    file: MulterFileType,
  ): Promise<any> {
    return await this.createOneDoc(CreateUserDto, file, User.name, {
      fileFieldName: 'avatar',
      checkField: 'email',
      fieldValue: CreateUserDto.email,
    });
  }
  async getUsers(QueryString: QueryString): Promise<any> {
    return await this.findAllDoc(User.name, QueryString);
  }

  async findOne(idParamDto: IdParamDto) {
    return await this.findOneDoc(idParamDto, '-__v');
  }

  async update_user(
    idParamDto: IdParamDto,
    UpdateUserDto: UpdateUserDto,
    file: MulterFileType,
  ): Promise<any> {
    const selectedFields = '_id avatar email';
    return await this.updateOneDoc(
      idParamDto,
      UpdateUserDto,
      file,
      User.name,
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
