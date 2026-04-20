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
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';

@Controller('users')
@Roles(roles.ADMIN)
@UseGuards(AuthGuard, RoleGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  /* ------------ =============================== ---------- */
  /* ------------ ======  GET USERS STATISTICS  ====== ------- */
  /* ------------ =============================== ---------- */
  /* ------------ ======  GET USERS STATISTICS  ====== ------- */
  /* ------------ =============================== ---------- */
  @Get('statistics')
  async get_users_statistics(): Promise<any> {
    return await this.usersService.get_users_statistics();
  }

  /* ------------ =============================== ---------- */
  /* ------------ ======  CREATE USER  ====== ---------------- */
  /* ------------ =============================== ---------- */
  @Post('create-user')
  @UseInterceptors(FileInterceptor('avatar'))
  createUser(
    @Body()
    CreateUserDto: CreateUserDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ) {
    return this.usersService.createUser(CreateUserDto, file);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  GET ALL USERS  ====== ---------------- */
  /* ------------ =============================== ---------- */
  @Get()
  async getUsers(@Query() QueryDto: QueryString): Promise<any> {
    return await this.usersService.getUsers(QueryDto);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  GET USER BY ID  ====== ---------------- */
  /* ------------ =============================== ---------- */
  @Get(':id')
  findOne(@Param() IdParamDto: IdParamDto) {
    return this.usersService.findOne(IdParamDto);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  UPDATE USER  ====== ---------------- */
  /* ------------ =============================== ---------- */
  @Put(':id')
  @UseInterceptors(FileInterceptor('avatar'))
  update_user(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
    file: MulterFileType,
    @Param()
    IdParamDto: IdParamDto,
    @Body()
    UpdateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update_user(IdParamDto, UpdateUserDto, file);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  DELETE USER  ====== ---------------- */
  /* ------------ =============================== ---------- */
  @Delete(':id')
  delete_user(@Param() idParamDto: IdParamDto) {
    return this.usersService.delete_user(idParamDto);
  }
}
