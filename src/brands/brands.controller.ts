import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Query,
  Patch,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './shared/dto/create-brand.dto';
import { UpdateBrandDto } from './shared/dto/update-brand.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
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
import { Brand } from './shared/schemas/brand.schema';

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Post()
  @Roles(roles.ADMIN, roles.MANAGER)
  @UseGuards(AuthGuard, RoleGuard)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Create a new brand (Admin/Manager only)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateBrandDto })
  @ApiCreatedResponse({
    description: 'The brand has been successfully created.',
    type: Brand,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request. Invalid input data or missing image.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have required role.',
  })
  async create(
    @Body() createBrandDto: CreateBrandDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ): Promise<any> {
    return await this.brandsService.create(createBrandDto, file);
  }

  @Get()
  @Roles(roles.USER, roles.ADMIN, roles.MANAGER)
  @ApiOperation({
    summary: 'Get all brands with optional filtering and pagination',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Sort order (e.g., -name)',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    type: String,
    description: 'Comma-separated list of fields to include (e.g., name,image)',
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    type: String,
    description: 'Search keyword for brands',
  })
  @ApiOkResponse({ description: 'Return all brands.', type: [Brand] })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have required role.',
  })
  async findAll(@Query() queryString: QueryString) {
    return await this.brandsService.findAll(queryString);
  }

  @Get('statistics')
  @Roles(roles.ADMIN, roles.MANAGER)
  @UseGuards(AuthGuard, RoleGuard)
  @ApiOperation({ summary: 'Get brand statistics (Admin/Manager only)' })
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Brand statistics retrieved successfully.' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have required role.',
  })
  async BrandsStatistics() {
    return await this.brandsService.BrandsStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a brand by ID' })
  @ApiParam({
    name: 'id',
    description: 'ID of the brand to retrieve',
    type: String,
  })
  @ApiOkResponse({ description: 'Return a single brand.', type: Brand })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Brand not found.',
  })
  async findOne(@Param() idParamDto: IdParamDto) {
    return await this.brandsService.findOne(idParamDto);
  }

  @Patch(':id')
  @Roles(roles.ADMIN, roles.MANAGER)
  @UseGuards(AuthGuard, RoleGuard)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary: 'Update an existing brand by ID (Admin/Manager only)',
  })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateBrandDto })
  @ApiParam({
    name: 'id',
    description: 'ID of the brand to update',
    type: String,
  })
  @ApiOkResponse({
    description: 'The brand has been successfully updated.',
    type: Brand,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request. Invalid input data.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have required role.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Brand not found.',
  })
  async updateBrand(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
    file: MulterFileType,
    @Param() idParamDto: IdParamDto,
    @Body() updateBrandDto: UpdateBrandDto,
  ): Promise<any> {
    return await this.brandsService.updateBrand(
      idParamDto,
      updateBrandDto,
      file,
    );
  }

  @Delete(':id')
  @Roles(roles.ADMIN, roles.MANAGER)
  @UseGuards(AuthGuard, RoleGuard)
  @ApiOperation({ summary: 'Delete a brand by ID (Admin/Manager only)' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    description: 'ID of the brand to delete',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The brand has been successfully deleted.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have required role.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Brand not found.',
  })
  async remove(@Param() idParamDto: IdParamDto) {
    return await this.brandsService.deleteOne(idParamDto);
  }
}
