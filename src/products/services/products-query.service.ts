import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from '../shared/schemas/ProductVariant.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { I18nContext } from 'nestjs-i18n';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VariantFilterParams } from '../shared/utils/variant-query-builder';

/**
 * Read-only product operations: findAll, findOne, findAllWithFilters.
 * Caching is handled at the Controller level via @CacheInterceptor.
 */
@Injectable()
export class ProductQueryService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<ProductVariantDocument>,
    private readonly i18n: CustomI18nService,
  ) {}

  // ──────────────────────────────────────────────────────
  //  HELPERS
  // ──────────────────────────────────────────────────────

  getCurrentLang(): string {
    return I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
  }

  localize(data: Product | Product[]) {
    const toJSONLocalizedOnly = this.productModel.schema.methods
      ?.toJSONLocalizedOnly as
      | ((data: Product | Product[], lang: string) => Product)
      | undefined;

    return typeof toJSONLocalizedOnly === 'function'
      ? toJSONLocalizedOnly(data as Product, this.getCurrentLang())
      : data;
  }

  /**
   * Fetches variants for multiple products and groups them by productId.
   */
  private async getVariantsByProducts(
    productIds: Types.ObjectId[],
  ): Promise<Map<string, any[]>> {
    const allVariants = await this.variantModel
      .find({ productId: { $in: productIds } })
      .lean();

    const map = new Map<string, typeof allVariants>();
    for (const v of allVariants) {
      const key = v.productId.toString();
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(v);
    }
    return map;
  }

  /**
   * Maps products array with their variants into the response format.
   */
  private mapProductsWithVariants(
    products: any[],
    variantsByProduct: Map<string, any[]>,
    allLangs: boolean,
  ) {
    const localizedProducts = allLangs
      ? products
      : this.localize(products);

    const productsArray = Array.isArray(localizedProducts)
      ? localizedProducts
      : [localizedProducts];

    return productsArray.map((product: any) => ({
      ...(product.toJSON?.() ?? product),
      variants: variantsByProduct.get(product._id?.toString()) ?? [],
    }));
  }

  // ──────────────────────────────────────────────────────
  //  GET ALL PRODUCTS
  // ──────────────────────────────────────────────────────

  async findAll(queryString: QueryString, allLangs: boolean = false) {
    const baseFilter = {};
    const baseQuery = this.productModel.find(baseFilter).select('-__v');

    // Run count and query in parallel
    const [total, features] = await Promise.all([
      this.productModel.countDocuments(baseFilter),
      Promise.resolve(
        new ApiFeatures(baseQuery, queryString)
          .filter()
          .search(Product.name)
          .sort()
          .limitFields(),
      ),
    ]);

    features.paginate(total);

    const products = await features
      .getQuery()
      .populate('category', 'name')
      .populate('brand', 'name')
      .exec();

    if (!products || products.length === 0) {
      throw new BadRequestException(
        this.i18n.translate('exception.NOT_FOUND'),
      );
    }

    // Fetch variants for all products in a single query
    const productIds = products.map((p) => p._id);
    const variantsByProduct = await this.getVariantsByProducts(productIds);

    const data = this.mapProductsWithVariants(
      products,
      variantsByProduct,
      allLangs,
    );

    return {
      results: products.length,
      total,
      pagination: features.getPagination(),
      data,
    };
  }

  // ──────────────────────────────────────────────────────
  //  FIND ALL WITH VARIANT FILTERS
  // ──────────────────────────────────────────────────────

  async findAllWithFilters(
    queryString: QueryString,
    variantFilters: VariantFilterParams,
    allLangs: boolean = false,
  ) {
    // Build variant filter
    const vFilter: Record<string, any> = {};

    if (variantFilters.color) {
      vFilter['attributes.color'] = {
        $regex: new RegExp(variantFilters.color, 'i'),
      };
    }

    if (variantFilters.weightMin || variantFilters.weightMax) {
      vFilter['attributes.weight.value'] = {};
      if (variantFilters.weightMin)
        vFilter['attributes.weight.value'].$gte = variantFilters.weightMin;
      if (variantFilters.weightMax)
        vFilter['attributes.weight.value'].$lte = variantFilters.weightMax;
      if (variantFilters.weightUnit) {
        vFilter['attributes.weight.unit'] =
          variantFilters.weightUnit.toLowerCase();
      }
    }

    if (variantFilters.volumeMin || variantFilters.volumeMax) {
      vFilter['attributes.volume.value'] = {};
      if (variantFilters.volumeMin)
        vFilter['attributes.volume.value'].$gte = variantFilters.volumeMin;
      if (variantFilters.volumeMax)
        vFilter['attributes.volume.value'].$lte = variantFilters.volumeMax;
      if (variantFilters.volumeUnit) {
        vFilter['attributes.volume.unit'] =
          variantFilters.volumeUnit.toLowerCase();
      }
    }

    if (variantFilters.priceMin || variantFilters.priceMax) {
      vFilter.price = {};
      if (variantFilters.priceMin) vFilter.price.$gte = variantFilters.priceMin;
      if (variantFilters.priceMax) vFilter.price.$lte = variantFilters.priceMax;
    }

    // Find matching variant productIds
    let productIds: Types.ObjectId[] | null = null;
    if (Object.keys(vFilter).length > 0) {
      const matchingVariants = await this.variantModel
        .find(vFilter)
        .select('productId')
        .lean();
      productIds = [...new Set(matchingVariants.map((v) => v.productId))];

      if (productIds.length === 0) {
        return { results: 0, total: 0, pagination: {}, data: [] };
      }
    }

    // Build product query
    const filter: Record<string, any> = {};
    if (productIds) {
      filter._id = { $in: productIds };
    }

    const baseQuery = this.productModel.find(filter).select('-__v');

    // Run count and query in parallel
    const [total, features] = await Promise.all([
      this.productModel.countDocuments(filter),
      Promise.resolve(
        new ApiFeatures(baseQuery, queryString)
          .filter()
          .search(Product.name)
          .sort()
          .limitFields(),
      ),
    ]);

    features.paginate(total);

    const products = await features
      .getQuery()
      .populate('category', 'name')
      .populate('brand', 'name')
      .exec();

    if (!products || products.length === 0) {
      return {
        results: 0,
        total: 0,
        pagination: features.getPagination(),
        data: [],
      };
    }

    // Fetch all variants for the found products
    const foundIds = products.map((p) => p._id);
    const variantsByProduct = await this.getVariantsByProducts(foundIds);

    const data = this.mapProductsWithVariants(
      products,
      variantsByProduct,
      allLangs,
    );

    return {
      results: products.length,
      total,
      pagination: features.getPagination(),
      data,
    };
  }

  // ──────────────────────────────────────────────────────
  //  GET ONE PRODUCT
  // ──────────────────────────────────────────────────────

  async findOne(idParamDto: IdParamDto, allLangs: boolean = false) {
    const { id } = idParamDto;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isObjectId ? { _id: id } : { slug: id };

    const product = await this.productModel
      .findOne(filter)
      .select('-__v')
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('supplier', 'name')
      .populate('supCategories', 'name')
      .exec();

    if (!product) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }

    // Fetch variants for this product
    const variants = await this.variantModel
      .find({ productId: product._id })
      .lean();

    const localizedProduct = allLangs ? product : this.localize(product);

    return {
      product: localizedProduct,
      variants,
    };
  }
}
