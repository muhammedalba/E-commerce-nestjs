import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { User, UserDocument } from 'src/users/shared/schemas/user.schema';
import { CreateUserDto } from './shared/dto/create-user.dto';
import { UpdateUserDto } from './shared/dto/update-user.dto';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { BaseService } from 'src/shared/utils/service/base.service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { MulterFile } from 'src/shared/utils/interfaces/fileInterface';

@Injectable()
export class UsersService extends BaseService<UserDocument> {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
  ) {
    super(userModel, i18n);
  }

  async createUser(
    CreateUserDto: CreateUserDto,
    file: MulterFile,
  ): Promise<any> {
    const { email } = CreateUserDto;
    //1) check if email  already exists
    const isExists = await this.userModel.exists({
      email: email,
    });
    if (isExists) {
      throw new BadRequestException(
        this.i18n.translate('exception.EMAIL_EXISTS'),
      );
    }
    //2) file upload service (save image in disk storage)
    let filePath = `/${process.env.UPLOADS_FOLDER}/users/avatar.png`;
    if (file) {
      try {
        filePath = await this.fileUploadService.saveFileToDisk(
          file,
          `./${process.env.UPLOADS_FOLDER}/users`,
        );
      } catch (error) {
        console.error('File upload failed: ERROR_FILE_UPLOAD', error);
        throw new InternalServerErrorException(
          this.i18n.translate('exception.ERROR_FILE_UPLOAD'),
        );
      }
    }

    //3) save user to db with avatar path
    CreateUserDto.avatar = filePath;
    const newUser = await this.userModel.create(CreateUserDto);
    // 4) update avatar url
    newUser.avatar = `${process.env.BASE_URL}${filePath}`;

    // handel response
    const userWithTokens = {
      ...newUser.toObject(),
      password: undefined,
      __v: undefined,
    };

    return {
      status: 'success',
      message: this.i18n.translate('success.updated_SUCCESS'),
      data: userWithTokens,
    };
  }
  async getUsers(QueryDto: QueryString): Promise<any> {
    return await this.findAll('users', QueryDto);
  }

  // createMany(file: file) {
  //   const filesPath = this.fileUploadService.saveFilesToDisk(
  //     file,
  //     './uploads/users',
  //   );
  //   return filesPath;
  // }

  async findOne(id: string) {
    return await this.findById(id);
  }

  async update_user(
    id: string,
    UpdateUserDto: UpdateUserDto,
    file: MulterFile,
  ) {
    //1) check  user if found
    const user = await this.userModel.findById(id).select('_id avatar');
    if (!user) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }
    //2) check if email already exists
    if (UpdateUserDto.email) {
      const isExists = await this.userModel
        .exists({
          email: UpdateUserDto.email,
        })
        .lean();
      if (isExists) {
        throw new BadRequestException(
          this.i18n.translate('exception.EMAIL_EXISTS'),
        );
      }
    }

    // 3) update user avatar if new file is provided
    if (file) {
      const destinationPath = `./${process.env.UPLOADS_FOLDER}/users`;
      const oldAvatarPath = `.${user.avatar}`;
      const avatarPath = await this.fileUploadService.updateFile(
        file,
        destinationPath,
        oldAvatarPath,
      );
      // 4) update user avatar
      UpdateUserDto.avatar = avatarPath;
    }
    // 5) update user in the database
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        { _id: user._id },
        { $set: UpdateUserDto },
        { new: true, runValidators: true, upsert: true },
      )
      .select('-__v');
    return {
      status: 'success',
      message: this.i18n.translate('success.updated_SUCCESS'),
      data: updatedUser,
    };
  }

  async delete_user(id: string): Promise<void> {
    // 1) check  user if found
    const user = await this.userModel.findById(id).select('_id avatar role');
    if (!user) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }
    if (user.role === 'admin') {
      throw new UnauthorizedException(
        this.i18n.translate('exception.UNAUTHORIZED'),
      );
    }
    // 2) delete  user from the database
    await this.userModel.deleteOne({ _id: user._id });
    //3) delete avatar file from disk
    if (user.avatar) {
      const path = `.${user.avatar}`;
      try {
        await this.fileUploadService.deleteFile(path);
      } catch (error) {
        console.error(`Error deleting file ${path}:`, error);
        throw new BadGatewayException(
          this.i18n.translate('exception.PROFILE_UPDATE_OLD-IMAGE'),
        );
      }
    }
    return;
  }
}
