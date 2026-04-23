import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SupCategoryService } from './sup-category.service';
import { CreateSupCategoryDto } from './shared/dto/create-sup-category.dto';
import { UpdateSupCategoryDto } from './shared/dto/update-sup-category.dto';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';

@Controller('sup-category')
export class SupCategoryController {
  constructor(private readonly supCategoryService: SupCategoryService) {}

  // ------------ =============================== ---------- //
  // ------------ ======  CREATE SUP CATEGORY  ====== ---------- //
  // ------------ =============================== ---------- //
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Post()
  create(
    @Body() createSupCategoryDto: CreateSupCategoryDto,
  ) {
    return this.supCategoryService.create(createSupCategoryDto);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET ALL SUP CATEGORIES ====== ---------- //
  // ------------ =============================== ---------- //
  @Get()
  @Roles(roles.ADMIN, roles.MANAGER, roles.USER)
  findAll(
    @Query() queryString: QueryString,
    @Query('all_langs') allLangs?: string,
  ) {
    const returnAllLangs = allLangs === 'true';
    return this.supCategoryService.findAll(queryString, returnAllLangs);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET ALL SUP CATEGORIES STATISTICS ====== ---------- //
  // ------------ =============================== ---------- //
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Get('statistics')
  findStatistics() {
    return this.supCategoryService.findStatistics();
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET SUP CATEGORY BY ID  ====== ---------- //
  // ------------ =============================== ---------- //
  @Get(':id')
  findOne(
    @Param() idParamDto: IdParamDto,
    @Query('all_langs') allLangs?: string,
  ) {
    const returnAllLangs = allLangs === 'true';
    return this.supCategoryService.findOne(idParamDto, returnAllLangs);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  UPDATE SUP CATEGORY  ====== ---------- //
  // ------------ =============================== ---------- //
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Patch(':id')
  update(
    @Param() idParamDto: IdParamDto,
    @Body() updateSupCategoryDto: UpdateSupCategoryDto,
  ) {
    return this.supCategoryService.update(idParamDto, updateSupCategoryDto);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  DELETE SUP CATEGORY  ====== ---------- //
  // ------------ =============================== ---------- //
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Delete(':id')
  remove(@Param() idParamDto: IdParamDto) {
    return this.supCategoryService.remove(idParamDto);
  }
}
