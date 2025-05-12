import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './shared/dto/create-product.dto';
import { UpdateProductDto } from './shared/dto/update-product.dto';

@Injectable()
export class ProductsService {
  create(createProductDto: CreateProductDto, files: any) {
    // console.log(createProductDto, 'createProductDto');
    console.log(files, 'files');

    return 'This action adds a new product';
  }

  findAll() {
    return `This action returns all products`;
  }

  findOne(id: number) {
    return `This action returns a #${id} product`;
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return `This action updates a #${id} product`;
  }

  remove(id: number) {
    return `This action removes a #${id} product`;
  }
}
