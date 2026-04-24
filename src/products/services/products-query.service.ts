import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from '../shared/schemas/ProductVariant.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { I18nContext } from 'nestjs-i18n';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
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

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  //  1. HELPERS (Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜Â§Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Âª)
  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬


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
  //  * Ã˜Â¨Ã™â€ Ã˜Â§Ã˜Â¡ Ã™ÂÃ™â€žÃ˜ÂªÃ˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ˜ÂºÃ™Å Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â¨Ã™â€ Ã˜Â§Ã˜Â¡Ã™â€¹ Ã˜Â¹Ã™â€žÃ™â€° skuSearch Ã™Ë†Ã˜Â®Ã˜ÂµÃ˜Â§Ã˜Â¦Ã˜Âµ Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ˜ÂºÃ™Å Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â®Ã˜Â±Ã™â€°
  //  */
  // private buildVariantFilter(vParams: VariantFilterParams, skuSearch?: string): Record<string, any> {
  //   const filter: Record<string, any> = { isDeleted: false, isActive: true };
  //   console.log("build Variant Filter", vParams, skuSearch);
  //   // Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â­Ã˜Â« Ã˜Â¹Ã™â€  SKU Ã˜Â¨Ã˜Â´Ã™Æ’Ã™â€ž Ã˜ÂµÃ˜Â±Ã™Å Ã˜Â­ Ã˜Â¨Ã™â€ Ã˜Â§Ã˜Â¡Ã™â€¹ Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â®Ã˜Â·Ã˜ÂªÃ™Æ’
  //   if (skuSearch) {
  //     filter.sku = { $regex: skuSearch, $options: 'i' };
  //   }

  //   // Ã™ÂÃ™â€žÃ˜ÂªÃ˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã™Å Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â¹Ã™â€žÃ™â€° Ã™â€¦Ã˜Â³Ã˜ÂªÃ™Ë†Ã™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ˜ÂºÃ™Å Ã˜Â± (sold)
  //   if (vParams.soldMin) filter.sold = { $gte: Number(vParams.soldMin) };
  //   if (vParams.soldMax) filter.sold = { $lte: Number(vParams.soldMax) };
  //   // Ã™ÂÃ™â€žÃ˜ÂªÃ˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â³Ã™â€¦Ã˜Â§Ã˜Âª (Attributes)
  //   if (vParams.color) {
  //     const colors = vParams.color.split(',').map((c) => c.trim());
  //     filter['attributes.color'] = colors.length > 1
  //       ? { $in: colors.map((c) => new RegExp(c, 'i')) }
  //       : { $regex: new RegExp(vParams.color, 'i') };
  //   }

  //   // Ã™ÂÃ™â€žÃ˜ÂªÃ˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â²Ã™â€  Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â¬Ã™â€¦
  //   if (vParams.weightMin !== undefined || vParams.weightMax !== undefined) {
  //     filter['attributes.weight.value'] = { $ne: null };
  //     if (vParams.weightMin !== undefined) filter['attributes.weight.value'].$gte = vParams.weightMin;
  //     if (vParams.weightMax !== undefined) filter['attributes.weight.value'].$lte = vParams.weightMax;
  //   }
  //   console.log("buildVariantFilter", filter);
  //   return filter;
  // }

  /**
   * Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™â€šÃ™â€š Ã™â€¦Ã™â€¦Ã˜Â§ Ã˜Â¥Ã˜Â°Ã˜Â§ Ã™Æ’Ã˜Â§Ã™â€  Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨ Ã™Å Ã˜ÂªÃ˜Â·Ã™â€žÃ˜Â¨ Ã™ÂÃ˜Â­Ã˜Âµ Ã˜Â¬Ã˜Â¯Ã™Ë†Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ˜ÂºÃ™Å Ã˜Â±Ã˜Â§Ã˜Âª
   */
  private shouldQueryVariants(
    vParams: VariantFilterParams,
    skuSearch?: string,
  ): boolean {
    // console.log("shouldQueryVariants", vParams, skuSearch);
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

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  //  2. CORE LOGIC (Ã™â€¦Ã™â€ Ã˜Â·Ã™â€š Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°)
  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  private async getProcessedFeatures(
    queryString: QueryString,
    productIds?: Types.ObjectId[],
  ) {
    const filter: any = productIds ? { _id: { $in: productIds } } : {};
    const baseQuery = this.productModel.find(filter).select('-__v');

    // ApiFeatures Ã˜Â³Ã™Å Ã˜Â¹Ã˜Â§Ã™â€žÃ˜Â¬ keywords (Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â­Ã˜Â« Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â§Ã™â€¦) Ã™Ë† totalSold (Ã™ÂÃ™â€žÃ˜ÂªÃ˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã™Å Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â©)
    const features = new ApiFeatures(baseQuery, queryString)
      .filter()
      .search('Product');

    const total = await this.productModel.countDocuments(
      features.getQuery().getFilter(),
    );
    features.sort().limitFields().paginate(total);

    return { features, total };
  }

  private async assembleFinalResponse(
    products: any[],
    total: number,
    pagination: any,
    allLangs: boolean,
  ) {
    if (!products.length) return { results: 0, total: 0, pagination, data: [] };

    const productIds = products.map((p) => p._id);
    const variants = await this.variantModel
      .find({
        productId: { $in: productIds },
        isActive: true,
        isDeleted: false,
      })
      .lean();

    const data = products.map((product) => ({
      ...(product.toObject ? product.toObject() : product),
      variants: variants.filter(
        (v) => v.productId.toString() === product._id.toString(),
      ),
    }));

    // Ã˜Â³Ã˜ÂªÃ˜Â¬Ã˜Â¯ Ã˜Â£Ã™â€ Ã™â€¡Ã˜Â§ Ã˜ÂªÃ˜Â±Ã˜Â¬Ã™â€¦Ã˜Âª 'title' Ã™Ë† 'description' Ã˜ÂªÃ™â€žÃ™â€šÃ˜Â§Ã˜Â¦Ã™Å Ã˜Â§Ã™â€¹
    return {
      results: data.length,
      total,
      pagination,
      // data: this.localize(data, allLangs),
      data: this.i18n.localize(data, allLangs),
    };
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  //  3. PUBLIC API
  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  async findAll(queryString: QueryString, allLangs: boolean = false) {
    // Ã˜ÂªÃ™â€¦Ã˜Â±Ã™Å Ã˜Â± Ã™â€¦Ã˜ÂµÃ™ÂÃ™Ë†Ã™ÂÃ˜Â© Ã™ÂÃ˜Â§Ã˜Â±Ã˜ÂºÃ˜Â© Ã™â€žÃ™â‚¬ variantFilters Ã™â€žÃ™Å Ã˜Â¹Ã™â€¦Ã™â€ž Ã™Æ’Ã˜Â¨Ã˜Â­Ã˜Â« Ã˜Â¹Ã˜Â§Ã™â€¦
    return this.findAllWithFilters(queryString, {}, allLangs);
  }

  async findAllWithFilters(
    queryString: QueryString,
    variantFilters: VariantFilterParams,
    allLangs: boolean = false,
  ) {
    let productIds: Types.ObjectId[] | undefined;
    const skuSearch = queryString['skuSearch'] as string;

    // 1. Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â­Ã˜Â« Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ˜ÂºÃ™Å Ã˜Â±Ã˜Â§Ã˜Âª Ã˜Â¥Ã˜Â°Ã˜Â§ Ã™Ë†Ã™ÂÃ˜Â¬Ã˜Â¯ SKU Ã˜Â£Ã™Ë† Ã™ÂÃ™â€žÃ˜Â§Ã˜ÂªÃ˜Â± Ã˜ÂªÃ˜Â®Ã˜Âµ Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ˜ÂºÃ™Å Ã˜Â±
    if (this.shouldQueryVariants(variantFilters, skuSearch)) {
      const vFilter = buildVariantFilter(variantFilters);
      const matchingVariants = await this.variantModel
        .find(vFilter)
        .select('productId')
        .lean();

      productIds = [...new Set(matchingVariants.map((v) => v.productId))];

      // Ã˜Â¥Ã˜Â°Ã˜Â§ Ã™Æ’Ã˜Â§Ã™â€  Ã™â€¡Ã™â€ Ã˜Â§Ã™Æ’ skuSearch Ã™â€¦Ã˜Â­Ã˜Â¯Ã˜Â¯ Ã™Ë†Ã™â€žÃ™â€¦ Ã™Å Ã˜Â·Ã˜Â§Ã˜Â¨Ã™â€š Ã˜Â£Ã™Å  Ã˜Â´Ã™Å Ã˜Â¡Ã˜Å’ Ã™â€ Ã™â€ Ã™â€¡Ã™Å  Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â© Ã™ÂÃ™Ë†Ã˜Â±Ã˜Â§Ã™â€¹
      if (skuSearch && productIds.length === 0) {
        return { results: 0, total: 0, pagination: {}, data: [] };
      }
    }

    // 2. Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â­Ã˜Â« Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Âª (Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã™â€¦Ã˜Å’ Ã˜Â§Ã™â€žÃ™Ë†Ã˜ÂµÃ™ÂÃ˜Å’ Ã™Ë†Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã™Å Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© totalSold) Ã˜Â¹Ã˜Â¨Ã˜Â± ApiFeatures
    const { features, total } = await this.getProcessedFeatures(
      queryString,
      productIds,
    );

    const products = await features
      .getQuery()
      .populate('category brand', 'name')
      .exec();

    return this.assembleFinalResponse(
      products,
      total,
      features.getPagination(),
      allLangs,
    );
  }

  async findOne(idParamDto: IdParamDto, allLangs: boolean = false) {
    const { id } = idParamDto;
    const filter = Types.ObjectId.isValid(id) ? { _id: id } : { slug: id };

    const product = await this.productModel
      .findOne(filter)
      .populate('category brand supplier SubCategories', 'name')
      .exec();

    if (!product)
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));

    const variants = await this.variantModel
      .find({ productId: product._id, isActive: true, isDeleted: false })
      .lean();

    // return { product: this.localize(product, allLangs), variants };
    return { product: this.i18n.localize(product, allLangs), variants };
  }
}
