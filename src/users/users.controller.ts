import {
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Delete,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { UsersService } from './users.service';
import { FileInterceptor } from '@nestjs/platform-express';

import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { CreateUserDto } from './shared/dto/create-user.dto';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { UpdateUserDto } from './shared/dto/update-user.dto';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';

import { Request } from 'express';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';

interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user: JwtPayload;
}

@Controller('users')
@UseGuards(AuthGuard, PermissionsGuard)
@UseInterceptors(ClearCacheInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  /* ------------ =============================== ---------- */
  /* ------------ ======  GET USERS STATISTICS  ====== ------- */
  /* ------------ =============================== ---------- */
  @Get('statistics')
  @RequirePermission(Permissions.VIEW_DASHBOARD_STATS)
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(300000) // 5 minutes
  async get_users_statistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    return await this.usersService.get_users_statistics(startDate, endDate);
  }

  /* ------------ =============================== ---------- */
  /* ------------ ======  CREATE USER  ====== ---------------- */
  /* ------------ =============================== ---------- */
  @Post()
  @RequirePermission(Permissions.CREATE_USER)
  @ClearCache('users')
  @UseInterceptors(FileInterceptor('avatar'))
  createUser(
    @Body()
    CreateUserDto: CreateUserDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.createUser(CreateUserDto, file, req.user);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  GET ALL USERS  ====== ---------------- */
  /* ------------ =============================== ---------- */
  @Get()
  @RequirePermission(Permissions.VIEW_USERS)
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  async getUsers(@Query() QueryDto: QueryString): Promise<any> {
    return await this.usersService.getUsers(QueryDto);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  GET USER BY ID  ====== ---------------- */
  /* ------------ =============================== ---------- */
  @Get(':id')
  @RequirePermission(Permissions.VIEW_USERS)
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  findOne(@Param() IdParamDto: IdParamDto) {
    return this.usersService.findOne(IdParamDto);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  UPDATE USER  ====== ---------------- */
  /* ------------ =============================== ---------- */
  @Patch(':id')
  @RequirePermission(Permissions.UPDATE_USER)
  @ClearCache('users')
  @UseInterceptors(FileInterceptor('avatar'))
  update_user(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
    @Param()
    idParamDto: IdParamDto,
    @Body()
    updateUserDto: UpdateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.update_user(
      idParamDto,
      updateUserDto,
      file,
      req.user,
    );
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  DELETE USER  ====== ---------------- */
  /* ------------ =============================== ---------- */
  @Delete(':id')
  @RequirePermission(Permissions.DELETE_USER)
  @ClearCache('users')
  delete_user(
    @Param() idParamDto: IdParamDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.delete_user(idParamDto, req.user);
  }
}
