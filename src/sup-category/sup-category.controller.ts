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
import { Roles } from 'src/auth/shared/decorators/rolesdecorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';

@Controller('sup-category')
@Roles(roles.ADMIN)
@UseGuards(AuthGuard, RoleGuard)
export class SupCategoryController {
  constructor(private readonly supCategoryService: SupCategoryService) {}

  @Post()
  create(@Body() createSupCategoryDto: CreateSupCategoryDto) {
    return this.supCategoryService.create(createSupCategoryDto);
  }

  @Get()
  @Roles(roles.ADMIN, roles.MANAGER, roles.USER)
  findAll(@Query() queryString: QueryString) {
    return this.supCategoryService.findAll(queryString);
  }
  @Get('Statistics')
  findStatistics() {
    return this.supCategoryService.findStatistics();
  }
  @Get(':id')
  findOne(@Param() idParamDto: IdParamDto) {
    return this.supCategoryService.findOne(idParamDto);
  }

  @Patch(':id')
  update(
    @Param() idParamDto: IdParamDto,
    @Body() updateSupCategoryDto: UpdateSupCategoryDto,
  ) {
    return this.supCategoryService.update(idParamDto, updateSupCategoryDto);
  }

  @Delete(':id')
  remove(@Param() idParamDto: IdParamDto) {
    return this.supCategoryService.remove(idParamDto);
  }
}
