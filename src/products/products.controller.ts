import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  Query,
  UseGuards,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './shared/dto/create-product.dto';
import { UpdateProductDto } from './shared/dto/update-product.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ParseFileFieldsPipe } from 'src/shared/files/ParseFileFieldsPipe';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { MaxFileCount } from 'src/shared/files/constants/file-count.constants';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { Roles } from 'src/auth/shared/decorators/rolesdecorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { MulterFilesType } from 'src/shared/utils/interfaces/fileInterface';
import { BrandExistsPipe } from 'src/shared/utils/pipes/brand-exists.pipe';
import { CategoryExistsPipe } from 'src/shared/utils/pipes/category-exists.pipe';
import { SupplierExistsPipe } from 'src/shared/utils/pipes/supplier-exists.pipe';
import { SupCategoryExistsPipe } from 'src/shared/utils/pipes/sup-category-exists.pipe';
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Product } from './shared/schemas/Product.schema';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}
  private static readonly imageSize = [
    { name: 'imageCover', maxCount: MaxFileCount.iMAGE_COVER },
    { name: 'images', maxCount: MaxFileCount.PRODUCTS_IMAGES },
    { name: 'infoProductPdf', maxCount: 1 },
  ];
  @Get('statistics')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ApiOperation({ summary: 'Get product statistics (Admin only)' })
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Product statistics retrieved successfully.' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have admin role.',
  })
  async Products_statistics() {
    return await this.productsService.Products_statistics();
  }

  @Post()
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @UseInterceptors(FileFieldsInterceptor(ProductsController.imageSize))
  @ApiOperation({ summary: 'Create a new product (Admin only)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        quantity: { type: 'number' },
        brand: { type: 'string' },
        category: { type: 'string' },
        supplier: { type: 'string' },
        supCategories: { type: 'string' },
        imageCover: {
          type: 'string',
          format: 'binary',
        },
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        infoProductPdf: {
          type: 'string',
          format: 'binary',
        },
      },
      required: [
        'name',
        'description',
        'price',
        'quantity',
        'brand',
        'category',
        'supplier',
        'imageCover',
      ],
    },
  })
  @ApiCreatedResponse({
    description: 'The product has been successfully created.',
    type: Product,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request. Invalid input data or missing imageCover.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have admin role.',
  })
  async create(
    @Body()
    createProductDto: CreateProductDto,
    @Body('brand', BrandExistsPipe) brand: string,
    @Body('category', CategoryExistsPipe) category: string,
    @Body('supplier', SupplierExistsPipe) supplier: string,
    @Body('supCategories', SupCategoryExistsPipe) supCategory: string,

    @UploadedFiles(
      new ParseFileFieldsPipe(
        '1MB',
        ['png', 'jpeg', 'webp', 'pdf'],
        [
          { name: 'imageCover', required: true },
          { name: 'images', required: false },
          { name: 'infoProductPdf', required: false },
        ],
      ),
    )
    files: {
      imageCover: MulterFilesType;
      images?: MulterFilesType;
      infoProductPdf?: MulterFilesType;
    },
  ) {
    if (!files.imageCover) {
      throw new BadRequestException('imageCover is required');
    }
    return await this.productsService.create(
      { ...createProductDto, category, brand, supplier },
      files as {
        imageCover: MulterFilesType;
        images?: MulterFilesType;
        infoProductPdf?: MulterFilesType;
      },
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all products with optional filtering and pagination',
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
    description: 'Sort order (e.g., -createdAt)',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    type: String,
    description: 'Comma-separated list of fields to include (e.g., name,price)',
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    type: String,
    description: 'Search keyword for products',
  })
  @ApiOkResponse({ description: 'Return all products.', type: [Product] })
  findAll(@Query() queryString: QueryString) {
    return this.productsService.findAll(queryString);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiParam({
    name: 'id',
    description: 'ID of the product to retrieve',
    type: String,
  })
  @ApiOkResponse({ description: 'Return a single product.', type: Product })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found.',
  })
  findOne(@Param() idParamDto: IdParamDto) {
    return this.productsService.findOne(idParamDto);
  }

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor(ProductsController.imageSize))
  @ApiOperation({ summary: 'Update an existing product by ID (Admin only)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        quantity: { type: 'number' },
        brand: { type: 'string' },
        category: { type: 'string' },
        supplier: { type: 'string' },
        supCategories: { type: 'string' },
        imageCover: {
          type: 'string',
          format: 'binary',
        },
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        infoProductPdf: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiParam({
    name: 'id',
    description: 'ID of the product to update',
    type: String,
  })
  @ApiOkResponse({
    description: 'The product has been successfully updated.',
    type: Product,
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
    description: 'Forbidden. User does not have admin role.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found.',
  })
  async update(
    @Param() idParamDto: IdParamDto,
    @Body() updateProductDto: UpdateProductDto,
    @Body('brand', BrandExistsPipe) brand: string,
    @Body('category', CategoryExistsPipe) category: string,
    @Body('supplier', SupplierExistsPipe) supplier: string,
    @Body('supCategories', SupCategoryExistsPipe) supCategory: string,
    @UploadedFiles(
      new ParseFileFieldsPipe(
        '1MB',
        ['png', 'jpeg', 'webp', 'pdf'],
        [
          { name: 'imageCover', required: false },
          { name: 'images', required: false },
          { name: 'infoProductPdf', required: false },
        ],
      ),
    )
    files: {
      imageCover?: MulterFilesType;
      images?: MulterFilesType;
      infoProductPdf?: MulterFilesType;
    },
  ) {
    return await this.productsService.update(
      idParamDto,
      { ...updateProductDto, brand, category, supplier },
      files,
    );
  }
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product by ID (Admin only)' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    description: 'ID of the product to delete',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The product has been successfully deleted.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have admin role.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found.',
  })
  remove(@Param() idParamDto: IdParamDto) {
    return this.productsService.remove(idParamDto);
  }
}
