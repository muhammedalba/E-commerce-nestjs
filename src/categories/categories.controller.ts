import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFile,
  UseInterceptors,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { CreateCategoryDto } from './shared/dto/create-category.dto';
import { UpdateCategoryDto } from './shared/dto/update-category.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { CategoriesService } from './categories.service';
import { Roles } from 'src/auth/shared/decorators/rolesdecorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Category } from './shared/schemas/category.schema';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoryService: CategoriesService) {}

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Get('statistics')
  @ApiOperation({ summary: 'Get category statistics (Admin only)' })
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Category statistics retrieved successfully.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized.' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden. User does not have admin role.' })
  async Categories_statistics() {
    return await this.categoryService.Categories_statistics();
  }

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Create a new category (Admin only)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateCategoryDto })
  @ApiCreatedResponse({ description: 'The category has been successfully created.', type: Category })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request. Invalid input data or missing image.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized.' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden. User does not have admin role.' })
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ): Promise<any> {
    return await this.categoryService.create(createCategoryDto, file);
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories with optional filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page' })
  @ApiQuery({ name: 'sort', required: false, type: String, description: 'Sort order (e.g., -name)' })
  @ApiQuery({ name: 'fields', required: false, type: String, description: 'Comma-separated list of fields to include (e.g., name,image)' })
  @ApiQuery({ name: 'keyword', required: false, type: String, description: 'Search keyword for categories' })
  @ApiOkResponse({ description: 'Return all categories.', type: [Category] })
  async findAll(@Query() queryString: QueryString) {
    return await this.categoryService.findAll(queryString);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category by ID' })
  @ApiParam({ name: 'id', description: 'ID of the category to retrieve', type: String })
  @ApiOkResponse({ description: 'Return a single category.', type: Category })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Category not found.' })
  async findOne(@Param() idParamDto: IdParamDto) {
    return await this.categoryService.findOne(idParamDto);
  }

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Update an existing category by ID (Admin only)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateCategoryDto })
  @ApiParam({ name: 'id', description: 'ID of the category to update', type: String })
  @ApiOkResponse({ description: 'The category has been successfully updated.', type: Category })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request. Invalid input data.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized.' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden. User does not have admin role.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Category not found.' })
  async update(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
    @Param() idParamDto: IdParamDto,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<any> {
    return await this.categoryService.update(
      idParamDto,
      updateCategoryDto,
      file,
    );
  }

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category by ID (Admin only)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'ID of the category to delete', type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'The category has been successfully deleted.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized.' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden. User does not have admin role.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Category not found.' })
  async remove(@Param() idParamDto: IdParamDto) {
    return await this.categoryService.deleteOne(idParamDto);
  }
}
