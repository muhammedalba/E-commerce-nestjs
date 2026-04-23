
import { Injectable, NotFoundException } from '@nestjs/common';
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
import { buildVariantFilter, VariantFilterParams } from '../shared/utils/variant-query-builder';
import { I18nHelper } from 'src/shared/utils/i18n/i18n-helper';

@Injectable()
export class ProductQueryService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<ProductVariantDocument>,
    private readonly i18n: CustomI18nService,
  ) { }

  // ──────────────────────────────────────────────────────
  //  1. HELPERS (المساعدات)
  // ──────────────────────────────────────────────────────

  private getCurrentLang(): string {
    return I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
  }

  // public localize(data: any, allLangs: boolean = false) {
  //   if (allLangs) return data;
  //   const lang = this.getCurrentLang();
  //   const translate = (obj: any) => {
  //     if (!obj) return obj;
  //     const raw = obj.toObject ? obj.toObject() : obj;
  //     return {
  //       ...raw,
  //       title: raw.title?.[lang] || raw.title,
  //       description: raw.description?.[lang] || raw.description,
  //       category: raw.category ? { ...raw.category, name: raw.category.name?.[lang] || raw.category.name } : raw.category,
  //       brand: raw.brand ? { ...raw.brand, name: raw.brand.name?.[lang] || raw.brand.name } : raw.brand,
  //     };
  //   };
  //   return Array.isArray(data) ? data.map(translate) : translate(data);
  // }

  // /**
  //  * بناء فلتر المتغيرات بناءً على skuSearch وخصائص المتغير الأخرى
  //  */
  // private buildVariantFilter(vParams: VariantFilterParams, skuSearch?: string): Record<string, any> {
  //   const filter: Record<string, any> = { isDeleted: false, isActive: true };
  //   console.log("build Variant Filter", vParams, skuSearch);
  //   // البحث عن SKU بشكل صريح بناءً على خطتك
  //   if (skuSearch) {
  //     filter.sku = { $regex: skuSearch, $options: 'i' };
  //   }

  //   // فلترة المبيعات على مستوى المتغير (sold)
  //   if (vParams.soldMin) filter.sold = { $gte: Number(vParams.soldMin) };
  //   if (vParams.soldMax) filter.sold = { $lte: Number(vParams.soldMax) };
  //   // فلترة السمات (Attributes)
  //   if (vParams.color) {
  //     const colors = vParams.color.split(',').map((c) => c.trim());
  //     filter['attributes.color'] = colors.length > 1
  //       ? { $in: colors.map((c) => new RegExp(c, 'i')) }
  //       : { $regex: new RegExp(vParams.color, 'i') };
  //   }

  //   // فلترة الوزن والحجم
  //   if (vParams.weightMin !== undefined || vParams.weightMax !== undefined) {
  //     filter['attributes.weight.value'] = { $ne: null };
  //     if (vParams.weightMin !== undefined) filter['attributes.weight.value'].$gte = vParams.weightMin;
  //     if (vParams.weightMax !== undefined) filter['attributes.weight.value'].$lte = vParams.weightMax;
  //   }
  //   console.log("buildVariantFilter", filter);
  //   return filter;
  // }

  /**
   * التحقق مما إذا كان الطلب يتطلب فحص جدول المتغيرات
   */
  private shouldQueryVariants(vParams: VariantFilterParams, skuSearch?: string): boolean {
    // console.log("shouldQueryVariants", vParams, skuSearch);
    return !!(skuSearch || vParams.color || vParams.soldMin || vParams.soldMax || vParams.weightMin || vParams.weightMax || vParams.volumeMin || vParams.volumeMax || vParams.volumeUnit || vParams.weightUnit);
  }

  // ──────────────────────────────────────────────────────
  //  2. CORE LOGIC (منطق التنفيذ)
  // ──────────────────────────────────────────────────────

  private async getProcessedFeatures(queryString: QueryString, productIds?: Types.ObjectId[]) {
    const filter: any = productIds ? { _id: { $in: productIds } } : {};
    const baseQuery = this.productModel.find(filter).select('-__v');

    // ApiFeatures سيعالج keywords (البحث العام) و totalSold (فلترة المبيعات الإجمالية)
    const features = new ApiFeatures(baseQuery, queryString).filter().search('Product');

    const total = await this.productModel.countDocuments(features.getQuery().getFilter());
    features.sort().limitFields().paginate(total);

    return { features, total };
  }

  private async assembleFinalResponse(products: any[], total: number, pagination: any, allLangs: boolean) {
    if (!products.length) return { results: 0, total: 0, pagination, data: [] };

    const productIds = products.map((p) => p._id);
    const variants = await this.variantModel
      .find({ productId: { $in: productIds }, isActive: true, isDeleted: false })
      .lean();

    const data = products.map((product) => ({
      ...(product.toObject ? product.toObject() : product),
      variants: variants.filter((v) => v.productId.toString() === product._id.toString()),
    }));

    // ستجد أنها ترجمت 'title' و 'description' تلقائياً
    return {
      results: data.length,
      total,
      pagination,
      // data: this.localize(data, allLangs),
      data: I18nHelper.localize(data, allLangs),
    };
  }

  // ──────────────────────────────────────────────────────
  //  3. PUBLIC API
  // ──────────────────────────────────────────────────────

  async findAll(queryString: QueryString, allLangs: boolean = false) {
    // تمرير مصفوفة فارغة لـ variantFilters ليعمل كبحث عام
    return this.findAllWithFilters(queryString, {}, allLangs);
  }

  async findAllWithFilters(
    queryString: QueryString,
    variantFilters: VariantFilterParams,
    allLangs: boolean = false,
  ) {
    let productIds: Types.ObjectId[] | undefined;
    const skuSearch = queryString['skuSearch'] as string;

    // 1. البحث في المتغيرات إذا وُجد SKU أو فلاتر تخص المتغير
    if (this.shouldQueryVariants(variantFilters, skuSearch)) {
      const vFilter = buildVariantFilter(variantFilters);
      const matchingVariants = await this.variantModel.find(vFilter).select('productId').lean();

      productIds = [...new Set(matchingVariants.map((v) => v.productId))];

      // إذا كان هناك skuSearch محدد ولم يطابق أي شيء، ننهي العملية فوراً
      if (skuSearch && productIds.length === 0) {
        return { results: 0, total: 0, pagination: {}, data: [] };
      }
    }

    // 2. البحث في المنتجات (الاسم، الوصف، والمبيعات الإجمالية totalSold) عبر ApiFeatures
    const { features, total } = await this.getProcessedFeatures(queryString, productIds);

    const products = await features.getQuery()
      .populate('category brand', 'name')
      .exec();

    return this.assembleFinalResponse(products, total, features.getPagination(), allLangs);
  }

  async findOne(idParamDto: IdParamDto, allLangs: boolean = false) {
    const { id } = idParamDto;
    const filter = Types.ObjectId.isValid(id) ? { _id: id } : { slug: id };

    const product = await this.productModel
      .findOne(filter)
      .populate('category brand supplier supCategories', 'name')
      .exec();

    if (!product) throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));

    const variants = await this.variantModel
      .find({ productId: product._id, isActive: true, isDeleted: false })
      .lean();

    // return { product: this.localize(product, allLangs), variants };
    return { product: I18nHelper.localize(product, allLangs), variants };
  }
}