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
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './shared/dto/create-product.dto';
import { UpdateProductDto } from './shared/dto/update-product.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ParseFileFieldsPipe } from 'src/shared/files/ParseFileFieldsPipe';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { MaxFileCount } from 'src/shared/files/constants/file-count.constants';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { MulterFilesType } from 'src/shared/utils/interfaces/fileInterface';
import { BrandExistsPipe } from 'src/shared/utils/pipes/brand-exists.pipe';
import { CategoryExistsPipe } from 'src/shared/utils/pipes/category-exists.pipe';
import { SupplierExistsPipe } from 'src/shared/utils/pipes/supplier-exists.pipe';
import { SupCategoryExistsPipe } from 'src/shared/utils/pipes/sup-category-exists.pipe';
import { ParseBodyJsonInterceptor } from 'src/shared/interceptors/parse-body-json.interceptor';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  private static readonly imageSize = [
    { name: 'imageCover', maxCount: MaxFileCount.iMAGE_COVER },
    { name: 'images', maxCount: MaxFileCount.PRODUCTS_IMAGES },
    { name: 'infoProductPdf', maxCount: 1 },
  ];

  // ──────────────────────────────────────────────────────
  //  Statistics
  // ──────────────────────────────────────────────────────

  @Get('statistics')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  async Products_statistics() {
    return await this.productsService.Products_statistics();
  }

  // ──────────────────────────────────────────────────────
  //  CREATE PRODUCT + VARIANTS (Transaction)
  // ──────────────────────────────────────────────────────

  @Post()
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @UseInterceptors(
    FileFieldsInterceptor(ProductsController.imageSize),
    new ParseBodyJsonInterceptor(
      ['title', 'description', 'variants', 'allowedAttributes'],
      ['supCategories'],
    ),
  )
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
    // console.log(createProductDto);
    return await this.productsService.create(
      { ...createProductDto, category, brand, supplier },
      files as {
        imageCover: MulterFilesType;
        images?: MulterFilesType;
        infoProductPdf?: MulterFilesType;
      },
    );
  }

  // ──────────────────────────────────────────────────────
  //  GET ALL PRODUCTS (with optional variant filters)
  // ──────────────────────────────────────────────────────

  @Get()
  findAll(
    @Query() queryString: QueryString,
    @Query('all_langs') allLangs?: string,
    @Query('color') color?: string,
    @Query('weight_min') weightMin?: string,
    @Query('weight_max') weightMax?: string,
    @Query('weight_unit') weightUnit?: string,
    @Query('volume_min') volumeMin?: string,
    @Query('volume_max') volumeMax?: string,
    @Query('volume_unit') volumeUnit?: string,
    @Query('price_min') priceMin?: string,
    @Query('price_max') priceMax?: string,
  ) {
    const returnAllLangs = allLangs === 'true';

    // Check if any variant filter is provided
    const hasVariantFilters =
      color ||
      weightMin ||
      weightMax ||
      weightUnit ||
      volumeMin ||
      volumeMax ||
      volumeUnit ||
      priceMin ||
      priceMax;

    if (hasVariantFilters) {
      return this.productsService.findAllWithFilters(
        queryString,
        {
          color,
          weightMin: weightMin ? Number(weightMin) : undefined,
          weightMax: weightMax ? Number(weightMax) : undefined,
          weightUnit,
          volumeMin: volumeMin ? Number(volumeMin) : undefined,
          volumeMax: volumeMax ? Number(volumeMax) : undefined,
          volumeUnit,
          priceMin: priceMin ? Number(priceMin) : undefined,
          priceMax: priceMax ? Number(priceMax) : undefined,
        },
        returnAllLangs,
      );
    }

    return this.productsService.findAll(queryString, returnAllLangs);
  }

  // ──────────────────────────────────────────────────────
  //  GET PRODUCT BY ID
  // ──────────────────────────────────────────────────────

  @Get(':id')
  findOne(
    @Param() idParamDto: IdParamDto,
    @Query('all_langs') allLangs?: string,
  ) {
    const returnAllLangs = allLangs === 'true';
    return this.productsService.findOne(idParamDto, returnAllLangs);
  }

  // ──────────────────────────────────────────────────────
  //  UPDATE PRODUCT + VARIANTS (Transaction)
  // ──────────────────────────────────────────────────────

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor(ProductsController.imageSize),
    new ParseBodyJsonInterceptor(
      ['title', 'description', 'variants', 'allowedAttributes'],
      ['supCategories'],
    ),
  )
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

  // ──────────────────────────────────────────────────────
  //  SOFT DELETE PRODUCT
  // ──────────────────────────────────────────────────────

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Delete(':id')
  remove(@Param() idParamDto: IdParamDto) {
    return this.productsService.remove(idParamDto);
  }

  // ──────────────────────────────────────────────────────
  //  HARD DELETE (permanently, admin-only)
  // ──────────────────────────────────────────────────────

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Delete(':id/permanent')
  hardRemove(@Param() idParamDto: IdParamDto) {
    return this.productsService.hardRemove(idParamDto);
  }

  // ──────────────────────────────────────────────────────
  //  RESTORE soft-deleted product
  // ──────────────────────────────────────────────────────

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Patch(':id/restore')
  restore(@Param() idParamDto: IdParamDto) {
    return this.productsService.restore(idParamDto);
  }
}
