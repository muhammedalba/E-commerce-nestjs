import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './shared/dto/create-product.dto';
import { UpdateProductDto } from './shared/dto/update-product.dto';
import { MulterFilesType } from 'src/shared/utils/interfaces/fileInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { ProductQueryService } from './services/products-query.service';
import { ProductMutationService } from './services/products-mutation.service';
import { ProductsStatistics } from './products-helper/products-statistics.service';
import { VariantFilterParams } from './shared/utils/variant-query-builder';

/**
 * Facade service — delegates to specialized sub-services.
 * Keeps the Controller contract unchanged while the internal
 * implementation is cleanly separated by responsibility.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly queryService: ProductQueryService,
    private readonly mutationService: ProductMutationService,
    private readonly productsStatistics: ProductsStatistics,
  ) {}

  // ──────────────────────────────────────────────────────
  //  STATISTICS
  // ──────────────────────────────────────────────────────

  async Products_statistics(startDate?: string, endDate?: string) {
    return this.productsStatistics.Products_statistics(startDate, endDate);
  }

  // ──────────────────────────────────────────────────────
  //  READ OPERATIONS (delegated to QueryService)
  // ──────────────────────────────────────────────────────

  async findAll(queryString: QueryString, allLangs: boolean = false) {
    return this.queryService.findAll(queryString, allLangs);
  }

  async findAllWithFilters(
    queryString: QueryString,
    variantFilters: VariantFilterParams,
    allLangs: boolean = false,
  ) {


    return  this.queryService.findAllWithFilters(
      queryString,
      variantFilters,
      allLangs,
    );
  }

  async findOne(idParamDto: IdParamDto, allLangs: boolean = false) {
    return this.queryService.findOne(idParamDto, allLangs);
  }

  // ──────────────────────────────────────────────────────
  //  WRITE OPERATIONS (delegated to MutationService)
  // ──────────────────────────────────────────────────────

  async create(
    createProductDto: CreateProductDto,
    files: {
      imageCover: MulterFilesType;
      images?: MulterFilesType;
      infoProductPdf?: MulterFilesType;
    },
  ) {
    return this.mutationService.create(createProductDto, files);
  }
 
  async update(
    idParamDto: IdParamDto,
    updateProductDto: UpdateProductDto,
    files: {
      imageCover?: MulterFilesType;
      infoProductPdf?: MulterFilesType;
      images?: MulterFilesType;
    },
  ) {
    return this.mutationService.update(idParamDto, updateProductDto, files);
  }

  async remove(idParamDto: IdParamDto) {
    return this.mutationService.remove(idParamDto);
  }

  async hardRemove(idParamDto: IdParamDto) {
    return this.mutationService.hardRemove(idParamDto);
  }

  async restore(idParamDto: IdParamDto) {
    return this.mutationService.restore(idParamDto);
  }
}