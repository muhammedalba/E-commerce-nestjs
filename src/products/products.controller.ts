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
import { Roles } from 'src/auth/shared/decorators/rolesdecorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { MulterFilesType } from 'src/shared/utils/interfaces/fileInterface';
import { BrandExistsPipe } from 'src/products/shared/pipes/brand-exists.pipe';
import { CategoryExistsPipe } from 'src/products/shared/pipes/category-exists.pipe';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}
  private static readonly imageSize = [
    { name: 'imageCover', maxCount: MaxFileCount.iMAGE_COVER },
    { name: 'images', maxCount: MaxFileCount.PRODUCTS_IMAGES },
    { name: 'infoProductPdf', maxCount: 1 },
  ];
  @Post()
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @UseInterceptors(FileFieldsInterceptor(ProductsController.imageSize))
  async create(
    @Body('brand', BrandExistsPipe) brand: string,
    @Body('category', CategoryExistsPipe) category: string,
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

  @Get()
  findAll(@Query() queryString: QueryString) {
    return this.productsService.findAll(queryString);
  }

  @Get(':id')
  findOne(@Param() idParamDto: IdParamDto) {
    return this.productsService.findOne(idParamDto);
  }
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor(ProductsController.imageSize))
  async update(
    @Param() idParamDto: IdParamDto,
    @Body('brand', BrandExistsPipe) brand: string,
    @Body('category', CategoryExistsPipe) category: string,
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
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Delete(':id')
  remove(@Param() idParamDto: IdParamDto) {
    return this.productsService.remove(idParamDto);
  }
}
