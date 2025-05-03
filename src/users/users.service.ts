import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { User } from 'src/users/shared/schemas/user.schema';
import { CreateUserDto } from './shared/dto/create-user.dto';
import slugify from 'slugify';
import { UpdateUserDto } from './shared/dto/update-user.dto';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';

type file = Express.Multer.File;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly fileUploadService: FileUploadService,
    private readonly i18n: CustomI18nService,
  ) {}

  async createUser(CreateUserDto: CreateUserDto, file: file): Promise<any> {
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
      message: this.i18n.translate('success.LOGIN_SUCCESS'),
      data: userWithTokens,
    };
  }
  async getUsers(): Promise<any> {
    const users = await this.userModel.find({}, { __v: 0, slug: 0 });
    return { status: 'success', length: users.length, data: users };
  }

  // createMany(file: file) {
  //   const filesPath = this.fileUploadService.saveFilesToDisk(
  //     file,
  //     './uploads/users',
  //   );
  //   return filesPath;
  // }

  async findOne(id: string) {
    const user = await this.userModel.findById(id).select('-__v');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update_user(id: string, UpdateUserDto: UpdateUserDto, file: file) {
    //1) check  user if found
    const user = await this.userModel.findById(id).select('_id avatar');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    //2) check if email already exists
    if (UpdateUserDto.email) {
      const isExists = await this.userModel
        .findOne({ email: UpdateUserDto.email })
        .select('email');
      if (isExists) {
        throw new BadRequestException('Email already exists');
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
    // if name is changed update slug
    if (UpdateUserDto.name && UpdateUserDto.name !== user.name) {
      UpdateUserDto.slug = slugify(UpdateUserDto.name, { lower: true });
    }
    // 4) update user in the database
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        { _id: user._id },
        { $set: UpdateUserDto },
        { upsert: true },
      )
      .select('-__v');
    return updatedUser;
  }

  async delete_user(id: string): Promise<void> {
    // 1) check  user if found
    const user = await this.userModel.findById(id).select('_id avatar');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // 2) delete  user from the database
    await this.userModel.deleteOne({ _id: user._id });
    //3) delete avatar file from disk
    const path = `.${user.avatar}`;
    if (user.avatar) {
      try {
        await this.fileUploadService.deleteFile(path);
      } catch (error) {
        console.error(`Error deleting file ${path}:`, error);
      }
    }
    return;
  }
}
