import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Put,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { FileInterceptor } from '@nestjs/platform-express';

import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { CreateUserDto } from './shared/dto/create-user.dto';
import { IdParamDto } from './shared/dto/id-param.dto';
import { UpdateUserDto } from './shared/dto/update-user.dto';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { roles } from 'src/auth/shared/enums/role.enum';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { Roles } from 'src/auth/shared/decorators/rolesdecorator';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { MulterFile } from 'src/shared/utils/interfaces/fileInterface';

//  * rote: http://localhost:4000/api/v1/users
//  * privet
@Controller('users')
@Roles(roles.ADMIN)
@UseGuards(AuthGuard, RoleGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  /*
   * Creates a new user with the provided data and avatar file.
   * The uploaded avatar file, validated to be of type png, jpeg, or webp and not exceeding 1MB.
   */
  @Post('create-user')
  @UseInterceptors(FileInterceptor('avatar'))
  createUser(
    @Body()
    CreateUserDto: CreateUserDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFile,
  ) {
    return this.usersService.createUser(CreateUserDto, file);
  }

  /**
   * Retrieves a list of all users.
   * rote: http://localhost:4000/api/v1/users
   * privet
   * returns An array of user objects.
   */
  @Get()
  async getUsers(@Query() QueryDto: QueryString): Promise<any> {
    return await this.usersService.getUsers(QueryDto);
  }

  // @Post('/users')
  // @UseInterceptors(FilesInterceptor('file', MaxFileCount.PRODUCTS_IMAGES))
  // createMany(
  //   @UploadedFiles(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
  //   file: Express.Multer.File,
  // ): any {
  //   return this.usersService.createMany(file);
  // }

  /**
   * rote: /api/v1/users
   * privet
   * Retrieves a user by their unique identifier.
   * @param IdParamDto - An object containing the user's ID.
   * @returns The user object corresponding to the provided ID.
   */
  @Get(':id')
  findOne(@Param() IdParamDto: IdParamDto) {
    return this.usersService.findOne(IdParamDto);
  }
  /*
   * rote: http://localhost:4000/api/v1/users/:id
   * privet
   */
  @Put(':id')
  @UseInterceptors(FileInterceptor('avatar'))
  update_user(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
    file: MulterFile,
    @Param()
    IdParamDto: IdParamDto,
    @Body()
    UpdateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update_user(IdParamDto, UpdateUserDto, file);
  }
  /*
   * rote: http://localhost:4000/api/v1/users:id
   * privet
   */
  @Delete(':id')
  delete_user(@Param() idParamDto: IdParamDto) {
    return this.usersService.delete_user(idParamDto);
  }
}
