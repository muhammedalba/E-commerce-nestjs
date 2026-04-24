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
import { CacheTTL } from '@nestjs/cache-manager';
import { ProductsService } from './products.service';
import { CreateProductDto } from './shared/dto/create-product.dto';
import { UpdateProductDto } from './shared/dto/update-product.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ParseFileFieldsPipe } from 'src/shared/files/ParseFileFieldsPipe';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { MaxFileCount } from 'src/shared/files/constants/file-count.constants';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { MulterFilesType } from 'src/shared/utils/interfaces/fileInterface';
import { ParseBodyJsonInterceptor } from 'src/shared/interceptors/parse-body-json.interceptor';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';

@Controller('products')
@UseInterceptors(ClearCacheInterceptor)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  private static readonly imageSize = [
    { name: 'imageCover', maxCount: MaxFileCount.iMAGE_COVER },
    { name: 'images', maxCount: MaxFileCount.PRODUCTS_IMAGES },
    { name: 'infoProductPdf', maxCount: 1 },
  ];

  // ----------------------------------------------------------------------------------------------------------------------------
  //  Statistics (cached 5 minutes)
  // ----------------------------------------------------------------------------------------------------------------------------

  @Get('statistics')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(300_000) // 5 minutes
  async Products_statistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.productsService.Products_statistics(startDate, endDate);
  }

  // ----------------------------------------------------------------------------------------------------------------------------
  //  CREATE PRODUCT + VARIANTS (Transaction)
  // ----------------------------------------------------------------------------------------------------------------------------

  @Post()
  @ClearCache('products')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @UseInterceptors(
    FileFieldsInterceptor(ProductsController.imageSize),
    new ParseBodyJsonInterceptor(
      ['title', 'description', 'variants', 'allowedAttributes'],
      ['SubCategories'],
    ),
  )
  async create(
    @Body()
    createProductDto: CreateProductDto,
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
      createProductDto,
      files as {
        imageCover: MulterFilesType;
        images?: MulterFilesType;
        infoProductPdf?: MulterFilesType;
      },
    );
  }

  // ----------------------------------------------------------------------------------------------------------------------------
  //  GET ALL PRODUCTS (cached 60 seconds)
  // ----------------------------------------------------------------------------------------------------------------------------

  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60_000) // 60 seconds
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
    @Query('sold_min') soldMin?: string,
    @Query('sold_max') soldMax?: string,
    @Query('skuSearch') skuSearch?: string,
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
      soldMin ||
      soldMax ||
      skuSearch;

    if (hasVariantFilters) {
      return this.productsService.findAllWithFilters(
        queryString,
        {
          color: color?.toLowerCase().trim(),
          weightMin: weightMin ? Number(weightMin) : undefined,
          weightMax: weightMax ? Number(weightMax) : undefined,
          weightUnit: weightUnit?.toLowerCase().trim(),
          volumeMin: volumeMin ? Number(volumeMin) : undefined,
          volumeMax: volumeMax ? Number(volumeMax) : undefined,
          volumeUnit: volumeUnit?.toLowerCase().trim(),
          soldMin: soldMin ? Number(soldMin) : undefined,
          soldMax: soldMax ? Number(soldMax) : undefined,
          skuSearch: skuSearch?.toLowerCase().trim(),
        },
        returnAllLangs,
      );
    }

    return this.productsService.findAll(queryString, returnAllLangs);
  }

  // ----------------------------------------------------------------------------------------------------------------------------
  //  GET PRODUCT BY ID (cached 120 seconds)
  // ----------------------------------------------------------------------------------------------------------------------------

  @Get(':id')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(120_000) // 120 seconds
  findOne(
    @Param() idParamDto: IdParamDto,
    @Query('all_langs') allLangs?: string,
  ) {
    const returnAllLangs = allLangs === 'true';
    return this.productsService.findOne(idParamDto, returnAllLangs);
  }

  // ----------------------------------------------------------------------------------------------------------------------------
  //  UPDATE PRODUCT + VARIANTS (Transaction)
  // ----------------------------------------------------------------------------------------------------------------------------

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('products')
  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor(ProductsController.imageSize),
    new ParseBodyJsonInterceptor(
      ['title', 'description', 'variants', 'allowedAttributes'],
      ['SubCategories'],
    ),
  )
  async update(
    @Param() idParamDto: IdParamDto,
    @Body() updateProductDto: UpdateProductDto,
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
      updateProductDto,
      files,
    );
  }

  // ----------------------------------------------------------------------------------------------------------------------------
  //  SOFT DELETE PRODUCT
  // ----------------------------------------------------------------------------------------------------------------------------

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('products')
  @Delete(':id')
  remove(@Param() idParamDto: IdParamDto) {
    return this.productsService.remove(idParamDto);
  }

  // ----------------------------------------------------------------------------------------------------------------------------
  //  HARD DELETE (permanently, admin-only)
  // ----------------------------------------------------------------------------------------------------------------------------

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('products')
  @Delete(':id/permanent')
  hardRemove(@Param() idParamDto: IdParamDto) {
    return this.productsService.hardRemove(idParamDto);
  }

  // ----------------------------------------------------------------------------------------------------------------------------
  //  RESTORE soft-deleted product
  // ----------------------------------------------------------------------------------------------------------------------------

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('products')
  @Patch(':id/restore')
  restore(@Param() idParamDto: IdParamDto) {
    return this.productsService.restore(idParamDto);
  }
}
