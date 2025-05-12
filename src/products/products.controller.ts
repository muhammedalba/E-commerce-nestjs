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
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './shared/dto/create-product.dto';
import { UpdateProductDto } from './shared/dto/update-product.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ParseFileFieldsPipe } from 'src/shared/files/ParseFileFieldsPipe';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}
  private static readonly imageSize = [
    { name: 'imageCover', maxCount: 1 },
    { name: 'images', maxCount: 3 },
    { name: 'infoProductPdf', maxCount: 3 },
  ];
  @Post()
  @UseInterceptors(FileFieldsInterceptor(ProductsController.imageSize))
  create(
    @Body() createProductDto: CreateProductDto,
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
      imageCover: Express.Multer.File;
      images: Express.Multer.File;
    },
  ) {
    return this.productsService.create(createProductDto, files);
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(+id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(+id);
  }
}
