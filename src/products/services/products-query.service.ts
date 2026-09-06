import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from '../shared/schemas/ProductVariant.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import {
  PaginationResult,
  QueryString,
} from 'src/shared/utils/interfaces/queryInterface';
import {
  buildVariantFilter,
  VariantFilterParams,
} from '../shared/utils/variant-query-builder';

@Injectable()
export class ProductQueryService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<ProductVariantDocument>,
    private readonly i18n: CustomI18nService,
  ) {}

  private shouldQueryVariants(
    vParams: VariantFilterParams,
    skuSearch?: string,
  ): boolean {
    return !!(
      skuSearch ||
      vParams.color ||
      vParams.soldMin ||
      vParams.soldMax ||
      vParams.weightMin ||
      vParams.weightMax ||
      vParams.volumeMin ||
      vParams.volumeMax ||
      vParams.volumeUnit ||
      vParams.weightUnit
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 1. CORE LOGIC
  // ─────────────────────────────────────────────────────────────

  private prepareFeatures(
    queryString: QueryString,
    productIds?: Types.ObjectId[],
  ) {
    const filter: FilterQuery<ProductDocument> = productIds
      ? { _id: { $in: productIds } }
      : {};
    const baseQuery = this.productModel.find(filter);
    const features = new ApiFeatures(baseQuery, queryString)
      .filter()
      .search(Product.name);

    features.sort().limitFields();
    return features;
  }

  private async assembleFinalResponse(
    products: Array<Product & { _id: Types.ObjectId }>,
    total: number,
    pagination: PaginationResult,
    allLangs: boolean,
  ) {
    if (!products.length) return { results: 0, total: 0, pagination, data: [] };
    console.log(products);

    const productIds = products.map((p) => p._id);
    const variants = await this.variantModel
      .find({
        productId: { $in: productIds },
        isActive: true,
        isDeleted: false,
      })
      .lean<Array<ProductVariant & { _id: Types.ObjectId }>>();

    // Group variants by productId in O(M) time using Map
    const variantsByProductId = new Map<
      string,
      Array<ProductVariant & { _id: Types.ObjectId }>
    >();
    for (const variant of variants) {
      const pid = variant.productId.toString();
      const list = variantsByProductId.get(pid);
      if (list) {
        list.push(variant);
      } else {
        variantsByProductId.set(pid, [variant]);
      }
    }

    // Map in O(1) lookup time per product
    const data = products.map((product) => ({
      ...product,
      variants: variantsByProductId.get(product._id.toString()) ?? [],
    }));

    // console.log(this.i18n.localize(data, allLangs));

    return {
      results: data.length,
      total,
      pagination,
      data: this.i18n.localize(data, allLangs),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. PUBLIC API
  // ─────────────────────────────────────────────────────────────

  async findAll(queryString: QueryString, allLangs: boolean = false) {
    return this.findAllWithFilters(queryString, {}, allLangs);
  }

  async findAllWithFilters(
    queryString: QueryString,
    variantFilters: VariantFilterParams,
    allLangs: boolean = false,
  ) {
    let productIds: Types.ObjectId[] | undefined;
    const skuSearch = queryString['skuSearch'] as string;

    // 1. استخراج معرفات المنتجات المطابقة للمتغيرات مباشرة من MongoDB عبر distinct
    if (this.shouldQueryVariants(variantFilters, skuSearch)) {
      const vFilter = buildVariantFilter(variantFilters);
      productIds = await this.variantModel.distinct('productId', {
        ...vFilter,
        isDeleted: { $ne: true },
      });

      if (skuSearch && productIds.length === 0) {
        return { results: 0, total: 0, pagination: {}, data: [] };
      }
    }

    // 2. تجهيز الفلاتر
    const features = this.prepareFeatures(queryString, productIds);

    const page = parseInt(queryString.page ?? '1', 10);
    const limit = parseInt(queryString.limit ?? '15', 10);
    const skip = (page - 1) * limit;

    // 3. تشغيل استعلام العد وجلب البيانات بالتوازي
    const [total, products] = await Promise.all([
      this.productModel.countDocuments(features.getQuery().getFilter()),
      features
        .getQuery()
        .skip(skip)
        .limit(limit)
        .populate('category brand', 'name')
        .lean<Array<Product & { _id: Types.ObjectId }>>()
        .exec(),
    ]);

    features.paginate(total);

    return this.assembleFinalResponse(
      products,
      total,
      features.getPagination(),
      allLangs,
    );
  }

  async findOne(idParamDto: IdParamDto, allLangs: boolean = false) {
    const { id } = idParamDto;
    const isObjectId = Types.ObjectId.isValid(id);
    const filter = isObjectId ? { _id: id } : { slug: id };

    // في حال كان المعرف ObjectId، يمكن جلب تفاصيل المنتج والمتغيرات بالتوازي
    if (isObjectId) {
      const [product, variants] = await Promise.all([
        this.productModel
          .findOne(filter)
          .populate('category brand supplier SubCategories', 'name')
          .lean()
          .exec(),
        this.variantModel
          .find({ productId: id, isActive: true, isDeleted: false })
          .lean()
          .exec(),
      ]);

      if (!product) {
        throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
      }

      return { product: this.i18n.localize(product, allLangs), variants };
    }

    const product = await this.productModel
      .findOne(filter)
      .populate('category brand supplier SubCategories', 'name')
      .lean()
      .exec();

    if (!product) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }

    const variants = await this.variantModel
      .find({ productId: product._id, isActive: true, isDeleted: false })
      .lean()
      .exec();

    return { product: this.i18n.localize(product, allLangs), variants };
  }
}
