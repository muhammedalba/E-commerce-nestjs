import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './shared/dto/create-product.dto';
import { UpdateProductDto } from './shared/dto/update-product.dto';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { Product, ProductDocument } from './shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from './shared/schemas/ProductVariant.schema';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import slugify from 'slugify';
import {
  MulterFilesType,
  MulterFileType,
} from 'src/shared/utils/interfaces/fileInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { I18nContext } from 'nestjs-i18n';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { ProductsStatistics } from './products-helper/products-statistics.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { validateAndNormalizeVariantsAttributes } from './shared/utils/attribute.validator';
import {
  generateDeterministicSku as generateSku,
  ensureUniqueSku,
} from './shared/utils/sku-generator';
import { VariantChangedEvent } from './products-helper/aggregation-sync.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(ProductVariant.name)
    private variantModel: Model<ProductVariantDocument>,
    @InjectConnection() private readonly connection: Connection,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
    protected readonly productsStatistics: ProductsStatistics,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ──────────────────────────────────────────────────────
  //  HELPERS
  // ──────────────────────────────────────────────────────

  private getCurrentLang(): string {
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

  private async uploadFile(
    file: MulterFileType,
    modelName: string,
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException(
        this.i18n.translate('exception.FILE_REQUIRED'),
      );
    }
    return this.fileUploadService.saveFileToDisk(file, modelName);
  }

  private async handleMultipleFilesUpload(
    files: MulterFilesType,
    folder: string,
  ): Promise<string[] | undefined> {
    if (!files || files.length === 0) return undefined;
    const fileArray = Array.isArray(files)
      ? files
      : Object.values(files).flat();
    return this.fileUploadService.saveFilesToDisk(fileArray, folder);
  }

  /**
   * (Removed legacy validateVariants in favor of attribute.validator.ts)
   */

  // ──────────────────────────────────────────────────────
  //  STATISTICS
  // ──────────────────────────────────────────────────────

  async Products_statistics() {
    return await this.productsStatistics.Products_statistics();
  }

  // ──────────────────────────────────────────────────────
  //  CREATE PRODUCT (Transaction)
  // ──────────────────────────────────────────────────────

  async create(
    createProductDto: CreateProductDto,
    files: {
      imageCover: MulterFilesType;
      images?: MulterFilesType;
      infoProductPdf?: MulterFilesType;
    },
  ) {
    const { variants, ...productData } = createProductDto;

    // 1) Validate variants BEFORE any DB operation
    if (!variants || variants.length === 0) {
      throw new BadRequestException('At least one variant is required');
    }

    // 2) Generate slug early for SKU generator
    productData.slug = slugify(productData.title.en.trim(), {
      lower: true,
      strict: true,
    });

    const isExists = await this.productModel.exists({
      slug: productData.slug,
    });
    if (isExists) {
      throw new BadRequestException(
        this.i18n.translate('exception.NAME_EXISTS'),
      );
    }

    // 3) Validate attributes
    validateAndNormalizeVariantsAttributes(
      variants,
      createProductDto.allowedAttributes || [],
    );

    // 4) Generate & Check SKUs
    for (const v of variants) {
      if (!v.sku) {
        v.sku = generateSku(productData.slug, v.attributes);
      } else {
        v.sku = v.sku.toUpperCase();
      }
    }

    const skus = variants.map((v) => v.sku as string);
    const skuSet = new Set(skus);
    if (skuSet.size !== skus.length) {
      throw new BadRequestException('Duplicate SKUs found in request');
    }

    const existingSkus = await this.variantModel
      .find({ sku: { $in: skus } })
      .select('sku')
      .lean();

    if (existingSkus.length > 0) {
      throw new BadRequestException(
        `SKU(s) already exist: ${existingSkus.map((s) => s.sku).join(', ')}`,
      );
    }

    // 5) Deduplicate supCategories
    if (productData.supCategories) {
      productData.supCategories = Array.from(
        new Set(productData.supCategories.map((id) => id.toString())),
      );
    }

    // 5) Handle file uploads
    try {
      if (
        files.imageCover &&
        Array.isArray(files.imageCover) &&
        files.imageCover[0]
      ) {
        productData.imageCover =
          (await this.uploadFile(files.imageCover[0], 'products')) ?? '';
      }

      if (
        files.infoProductPdf &&
        Array.isArray(files.infoProductPdf) &&
        files.infoProductPdf[0]
      ) {
        productData.infoProductPdf = await this.uploadFile(
          files.infoProductPdf[0],
          'products',
        );
      }

      productData.images = await this.handleMultipleFilesUpload(
        files.images,
        'products',
      );
    } catch (error) {
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }

    // 6) Start Transaction
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Create product
      const [newProduct] = await this.productModel.create(
        [productData as any],
        { session },
      );

      if (!newProduct) {
        throw new InternalServerErrorException('Failed to create product');
      }

      // Attach productId to all variants and bulk insert
      const variantDocs = variants.map((v) => ({
        ...v,
        productId: newProduct._id,
      }));

      for (const doc of variantDocs) {
        if (doc.sku) {
          doc.sku = await ensureUniqueSku(this.variantModel, doc.sku);
        }
      }

      const createdVariants = await this.variantModel.insertMany(variantDocs, {
        session,
      });

      // Commit
      await session.commitTransaction();

      // Emit async event for aggregation
      this.eventEmitter.emit(
        'variant.changed',
        new VariantChangedEvent(newProduct._id),
      );

      // Prepare response
      const baseUrl = process.env.BASE_URL || '';
      newProduct.imageCover = `${baseUrl}${productData.imageCover}`;
      newProduct.images = newProduct.images?.map((img) => `${baseUrl}${img}`);
      newProduct.infoProductPdf = productData.infoProductPdf
        ? `${baseUrl}${productData.infoProductPdf}`
        : undefined;

      return {
        product: this.localize(newProduct),
        variants: createdVariants,
      };
    } catch (error) {
      await session.abortTransaction();
      console.error('Transaction Error (create product):', error);
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    } finally {
      session.endSession();
    }
  }

  // ──────────────────────────────────────────────────────
  //  GET ALL PRODUCTS
  // ──────────────────────────────────────────────────────

  async findAll(queryString: QueryString, allLangs: boolean = false) {
    const baseQuery = this.productModel.find().select('-__v');
    const total = await this.productModel.countDocuments();

    const features = new ApiFeatures(baseQuery, queryString)
      .filter()
      .search(Product.name)
      .sort()
      .limitFields()
      .paginate(total);

    const products = await features
      .getQuery()
      .populate('category', 'name')
      .populate('brand', 'name')
      .exec();

    if (!products || products.length === 0) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }

    // Fetch variants for all products in one query
    const productIds = products.map((p) => p._id);
    const allVariants = await this.variantModel
      .find({ productId: { $in: productIds } })
      .lean();

    // Group variants by productId
    const variantsByProduct = new Map<string, typeof allVariants>();
    for (const v of allVariants) {
      const key = v.productId.toString();
      if (!variantsByProduct.has(key)) {
        variantsByProduct.set(key, []);
      }
      variantsByProduct.get(key)!.push(v);
    }

    const localizedProducts = allLangs ? products : this.localize(products);
    const productsArray = Array.isArray(localizedProducts)
      ? localizedProducts
      : [localizedProducts];

    const data = productsArray.map((product: any) => ({
      ...(product.toJSON?.() ?? product),
      variants: variantsByProduct.get(product._id?.toString()) ?? [],
    }));

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
    variantFilters: {
      color?: string;
      weightMin?: number;
      weightMax?: number;
      weightUnit?: string;
      volumeMin?: number;
      volumeMax?: number;
      volumeUnit?: string;
      priceMin?: number;
      priceMax?: number;
    },
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
    const total = await this.productModel.countDocuments(filter);

    const features = new ApiFeatures(baseQuery, queryString)
      .filter()
      .search(Product.name)
      .sort()
      .limitFields()
      .paginate(total);

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
    const allVariants = await this.variantModel
      .find({ productId: { $in: foundIds } })
      .lean();

    const variantsByProduct = new Map<string, typeof allVariants>();
    for (const v of allVariants) {
      const key = v.productId.toString();
      if (!variantsByProduct.has(key)) {
        variantsByProduct.set(key, []);
      }
      variantsByProduct.get(key)!.push(v);
    }

    const localizedProducts = allLangs ? products : this.localize(products);
    const productsArray = Array.isArray(localizedProducts)
      ? localizedProducts
      : [localizedProducts];

    const data = productsArray.map((product: any) => ({
      ...(product.toJSON?.() ?? product),
      variants: variantsByProduct.get(product._id?.toString()) ?? [],
    }));

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

  // ──────────────────────────────────────────────────────
  //  UPDATE PRODUCT (Transaction)
  // ──────────────────────────────────────────────────────

  async update(
    idParamDto: IdParamDto,
    updateProductDto: UpdateProductDto,
    files: {
      imageCover?: MulterFilesType;
      infoProductPdf?: MulterFilesType;
      images?: MulterFilesType;
    },
  ) {
    const { variants: variantOps, ...productData } = updateProductDto;

    // 1) Fetch existing product
    const doc = await this.productModel
      .findById(idParamDto.id)
      .select('infoProductPdf imageCover images supCategories')
      .lean();

    if (!doc) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }

    // 2) Handle slug change
    if (productData.title) {
      productData.slug = slugify(productData.title.en.trim(), {
        lower: true,
        strict: true,
      });

      const isExists = await this.productModel.exists({
        slug: productData.slug,
        _id: { $ne: doc._id },
      });
      if (isExists) {
        throw new BadRequestException(
          this.i18n.translate('exception.NAME_EXISTS'),
        );
      }
    }

    // 3) Validate new variants if any
    if (variantOps?.create && variantOps.create.length > 0) {
      validateAndNormalizeVariantsAttributes(
        variantOps.create,
        updateProductDto.allowedAttributes || doc.allowedAttributes || [],
      );

      const newBaseSlug = productData.slug || doc.slug;

      for (const v of variantOps.create) {
        if (!v.sku) {
          v.sku = generateSku(newBaseSlug, v.attributes);
        } else {
          v.sku = v.sku.toUpperCase(); // normalize provided
        }
      }

      // Check SKU uniqueness for new variants
      const newSkus = variantOps.create.map((v) => v.sku);
      const existingSkus = await this.variantModel
        .find({ sku: { $in: newSkus } })
        .select('sku')
        .lean();
      if (existingSkus.length > 0) {
        throw new BadRequestException(
          `SKU(s) already exist: ${existingSkus.map((s) => s.sku).join(', ')}`,
        );
      }
    }

    if (variantOps?.update && variantOps.update.length > 0) {
      validateAndNormalizeVariantsAttributes(
        variantOps.update as any[],
        updateProductDto.allowedAttributes || doc.allowedAttributes || [],
      );
      for (const v of variantOps.update) {
        if (v.sku) v.sku = v.sku.toUpperCase();
      }
    }

    // 4) Handle file uploads
    try {
      if (doc && files) {
        const singleFiles: Record<string, MulterFilesType | undefined> = {
          imageCover: files.imageCover,
          infoProductPdf: files.infoProductPdf,
        };

        for (const [key, file] of Object.entries(singleFiles)) {
          if (file && Array.isArray(file) && file[0]) {
            const newPath = await this.fileUploadService.saveFileToDisk(
              file[0] as MulterFileType,
              'products',
            );
            if (key === 'imageCover' || key === 'infoProductPdf') {
              const oldPath = doc[key] as string;
              if (oldPath) {
                await this.fileUploadService.deleteFile(`.${oldPath}`);
              }
            }
            (productData as any)[key] = newPath;
          }
        }

        if (Array.isArray(files.images) && files.images.length > 0) {
          if (doc.images) {
            await this.fileUploadService.deleteFiles(doc.images);
          }
          const newImages = await this.fileUploadService.saveFilesToDisk(
            files.images,
            'products',
          );
          (productData as any).images = newImages;
        }
      }
    } catch (error) {
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }

    // 5) Start Transaction
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Update product base fields
      const hasProductUpdates = Object.keys(productData).length > 0;
      let updatedProduct: ProductDocument | null = null;

      if (hasProductUpdates) {
        updatedProduct = await this.productModel.findByIdAndUpdate(
          idParamDto.id,
          { $set: productData },
          { new: true, runValidators: true, session },
        );
      } else {
        updatedProduct = await this.productModel
          .findById(idParamDto.id)
          .session(session);
      }

      if (!updatedProduct) {
        throw new NotFoundException('Product not found');
      }

      // Handle variant operations
      if (variantOps) {
        // CREATE new variants
        if (variantOps.create && variantOps.create.length > 0) {
          const newVariants = variantOps.create.map((v) => ({
            ...v,
            productId: updatedProduct._id,
          }));

          for (const doc of newVariants) {
            if (doc.sku) {
              doc.sku = await ensureUniqueSku(this.variantModel, doc.sku);
            }
          }

          await this.variantModel.insertMany(newVariants, { session });
        }

        // UPDATE existing variants
        if (variantOps.update && variantOps.update.length > 0) {
          for (const variantUpdate of variantOps.update) {
            const { _id, ...updateData } = variantUpdate;
            if (updateData.sku) {
              updateData.sku = updateData.sku.toUpperCase();
            }
            await this.variantModel.findOneAndUpdate(
              { _id, productId: updatedProduct._id },
              { $set: updateData },
              { runValidators: true, session },
            );
          }
        }

        // DELETE variants (soft delete)
        if (variantOps.delete && variantOps.delete.length > 0) {
          await this.variantModel.updateMany(
            {
              _id: { $in: variantOps.delete },
              productId: updatedProduct._id,
            },
            { $set: { isDeleted: true, deletedAt: new Date() } },
            { session },
          );
        }

        // Ensure at least one active variant remains
        const remainingCount = await this.variantModel
          .countDocuments({
            productId: updatedProduct._id,
            isDeleted: { $ne: true },
          })
          .session(session);

        if (remainingCount === 0) {
          throw new BadRequestException(
            'Cannot delete all variants. A product must have at least one variant.',
          );
        }
      }

      // Commit
      await session.commitTransaction();

      // Fetch full updated state
      const finalVariants = await this.variantModel
        .find({ productId: updatedProduct._id })
        .lean();

      return {
        product: this.localize(updatedProduct),
        variants: finalVariants,
      };
    } catch (error) {
      await session.abortTransaction();
      console.error('Transaction Error (update product):', error);

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    } finally {
      session.endSession();
    }
  }

  // ──────────────────────────────────────────────────────
  //  DELETE PRODUCT (Soft Delete - Transaction)
  // ──────────────────────────────────────────────────────

  async remove(idParamDto: IdParamDto) {
    const doc = await this.productModel
      .findById(idParamDto.id)
      .select('_id')
      .lean();

    if (!doc) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const now = new Date();

      // Soft delete product
      await this.productModel.findByIdAndUpdate(
        idParamDto.id,
        { $set: { isDeleted: true, deletedAt: now } },
        { session },
      );

      // Soft delete all variants
      await this.variantModel.updateMany(
        { productId: doc._id },
        { $set: { isDeleted: true, deletedAt: now } },
        { session },
      );

      await session.commitTransaction();
      return { message: 'Product and variants soft-deleted successfully' };
    } catch (error) {
      await session.abortTransaction();
      console.error('Transaction Error (delete product):', error);
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_DELETE'),
      );
    } finally {
      session.endSession();
    }
  }

  // ──────────────────────────────────────────────────────
  //  HARD DELETE (optional, admin-only)
  // ──────────────────────────────────────────────────────

  async hardRemove(idParamDto: IdParamDto) {
    const doc = await this.productModel
      .findOne({ _id: idParamDto.id, isDeleted: true })
      .select('imageCover infoProductPdf images')
      .lean();

    if (!doc) {
      throw new BadRequestException(
        'Product not found or not soft-deleted. Soft-delete first.',
      );
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Delete associated files
      if (doc.imageCover) {
        await this.fileUploadService.deleteFile(`.${doc.imageCover}`);
      }
      if (doc.infoProductPdf) {
        await this.fileUploadService.deleteFile(`.${doc.infoProductPdf}`);
      }
      if (doc.images && Array.isArray(doc.images)) {
        await this.fileUploadService.deleteFiles(doc.images);
      }

      // Hard delete variants first, then product
      await this.variantModel.deleteMany({ productId: doc._id }, { session });
      await this.productModel.findByIdAndDelete(doc._id, { session });

      await session.commitTransaction();
      return { message: 'Product and variants permanently deleted' };
    } catch (error) {
      await session.abortTransaction();
      console.error('Transaction Error (hard delete):', error);
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_DELETE'),
      );
    } finally {
      session.endSession();
    }
  }

  // ──────────────────────────────────────────────────────
  //  RESTORE PRODUCT (undo soft delete)
  // ──────────────────────────────────────────────────────

  async restore(idParamDto: IdParamDto) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const product = await this.productModel.findOneAndUpdate(
        { _id: idParamDto.id, isDeleted: true },
        { $set: { isDeleted: false, deletedAt: null } },
        { new: true, session },
      );

      if (!product) {
        throw new NotFoundException('Deleted product not found');
      }

      await this.variantModel.updateMany(
        { productId: product._id, isDeleted: true },
        { $set: { isDeleted: false, deletedAt: null } },
        { session },
      );

      await session.commitTransaction();

      const variants = await this.variantModel
        .find({ productId: product._id })
        .lean();

      return {
        product: this.localize(product),
        variants,
      };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to restore product');
    } finally {
      session.endSession();
    }
  }
}












// ──────────────────────────────────────────────────────
// {
//     "success": true,
//     "statusCode": 201,
//     "timestamp": "2026-04-18T20:13:56.297Z",
//     "path": "/api/v1/products",
//     "message": "Created successfully",
//     "data": {
//         "product": {
//             "title": "يxTo-nSRhixrtscYكvvYxv xxxlيرknx",
//             "slug": "yxto-nsrhixrtscykvvyxv-xxxlyrknx",
//             "description": "Slim-fitting style, contrast raglan long sleeve, three-button henley placket, light weight & soft fabric for breathable and comfortable wearing. And Solid stitched shirts with round neck made for durability and a great fit for casual fashion wear and diehard baseball fans. The Henley style round neckline includes a three-button placket.",
//             "imageCover": "http://localhost:4000/uploads/products/imageCover-1776543235377-1f8d757e-afa5-422c-b3e5-c28def609bbb.webp",
//             "images": [],
//             "category": "69e12d528a5f2a7058be8fcb",
//             "supCategories": [],
//             "brand": null,
//             "supplier": null,
//             "isUnlimitedStock": true,
//             "disabled": false,
//             "isFeatured": false,
//             "rating": 1,
//             "ratingsQuantity": 0,
//             "ratingsAverage": 0,
//             "allowedAttributesVersion": 1,
//             "allowedAttributes": [
//                 {
//                     "name": "color",
//                     "type": "string",
//                     "required": true,
//                     "allowedValues": [
//                         "red",
//                         "blue",
//                         "black"
//                     ]
//                 },
//                 {
//                     "name": "size",
//                     "type": "string",
//                     "required": true,
//                     "allowedValues": [
//                         "s",
//                         "m",
//                         "l",
//                         "xl"
//                     ]
//                 }
//             ],
//             "priceRange": {
//                 "min": 0,
//                 "max": 0
//             },
//             "stockSummary": 0,
//             "variantCount": 0,
//             "isDeleted": false,
//             "deletedAt": null,
//             "_id": "69e3e6033a1cb3b5eb8517de",
//             "createdAt": "2026-04-18T20:13:55.398Z",
//             "updatedAt": "2026-04-18T20:13:55.398Z",
//             "__v": 0
//         },
//         "variants": [
//             {
//                 "productId": "69e3e6033a1cb3b5eb8517de",
//                 "sku": "TSHIRT-RED-S",
//                 "price": 25,
//                 "stock": 50,
//                 "sold": 0,
//                 "attributes": {
//                     "color": "red",
//                     "size": "s"
//                 },
//                 "components": [],
//                 "image": "https://example.com/images/tshirt-red-s.jpg",
//                 "isActive": true,
//                 "isDeleted": false,
//                 "deletedAt": null,
//                 "_id": "69e3e6033a1cb3b5eb8517e4",
//                 "__v": 0,
//                 "createdAt": "2026-04-18T20:13:55.994Z",
//                 "updatedAt": "2026-04-18T20:13:55.994Z"
//             },
//             {
//                 "productId": "69e3e6033a1cb3b5eb8517de",
//                 "sku": "TSHIRT-RED-M",
//                 "price": 25,
//                 "stock": 40,
//                 "sold": 0,
//                 "attributes": {
//                     "color": "red",
//                     "size": "m"
//                 },
//                 "components": [],
//                 "image": "https://example.com/images/tshirt-red-m.jpg",
//                 "isActive": true,
//                 "isDeleted": false,
//                 "deletedAt": null,
//                 "_id": "69e3e6033a1cb3b5eb8517e5",
//                 "__v": 0,
//                 "createdAt": "2026-04-18T20:13:55.994Z",
//                 "updatedAt": "2026-04-18T20:13:55.994Z"
//             },
//             {
//                 "productId": "69e3e6033a1cb3b5eb8517de",
//                 "sku": "TSHIRT-BLUE-L",
//                 "price": 27,
//                 "stock": 30,
//                 "sold": 0,
//                 "attributes": {
//                     "color": "blue",
//                     "size": "l"
//                 },
//                 "components": [],
//                 "image": "https://example.com/images/tshirt-blue-l.jpg",
//                 "isActive": true,
//                 "isDeleted": false,
//                 "deletedAt": null,
//                 "_id": "69e3e6033a1cb3b5eb8517e6",
//                 "__v": 0,
//                 "createdAt": "2026-04-18T20:13:55.994Z",
//                 "updatedAt": "2026-04-18T20:13:55.994Z"
//             },
//             {
//                 "productId": "69e3e6033a1cb3b5eb8517de",
//                 "sku": "TSHIRT-BLACK-XL",
//                 "price": 30,
//                 "stock": 20,
//                 "sold": 0,
//                 "attributes": {
//                     "color": "black",
//                     "size": "xl"
//                 },
//                 "components": [],
//                 "image": "https://example.com/images/tshirt-black-xl.jpg",
//                 "isActive": true,
//                 "isDeleted": false,
//                 "deletedAt": null,
//                 "_id": "69e3e6033a1cb3b5eb8517e7",
//                 "__v": 0,
//                 "createdAt": "2026-04-18T20:13:55.994Z",
//                 "updatedAt": "2026-04-18T20:13:55.994Z"
//             }
//         ]
//     }
// }


// ------------------------------------------------------------------
// {
//     "success": true,
//     "statusCode": 201,
//     "timestamp": "2026-04-18T20:19:30.119Z",
//     "path": "/api/v1/products",
//     "message": "Created successfully",
//     "data": {
//         "product": {
//             "title": "يxTo-nSRhixrtsscYكvvYxv xxxlيرknx",
//             "slug": "yxto-nsrhixrtsscykvvyxv-xxxlyrknx",
//             "description": "Slim-fitting style, contrast raglan long sleeve, three-button henley placket, light weight & soft fabric for breathable and comfortable wearing. And Solid stitched shirts with round neck made for durability and a great fit for casual fashion wear and diehard baseball fans. The Henley style round neckline includes a three-button placket.",
//             "imageCover": "http://localhost:4000/uploads/products/imageCover-1776543569709-ccdaf323-5b5b-4cbc-8fe7-ccedf88ae32c.webp",
//             "images": [],
//             "category": "69e12d528a5f2a7058be8fcb",
//             "supCategories": [],
//             "brand": null,
//             "supplier": null,
//             "isUnlimitedStock": true,
//             "disabled": false,
//             "isFeatured": false,
//             "rating": 1,
//             "ratingsQuantity": 0,
//             "ratingsAverage": 0,
//             "allowedAttributesVersion": 1,
//             "allowedAttributes": [],
//             "priceRange": {
//                 "min": 0,
//                 "max": 0
//             },
//             "stockSummary": 0,
//             "variantCount": 0,
//             "isDeleted": false,
//             "deletedAt": null,
//             "_id": "69e3e75168e49ea690be0d4a",
//             "createdAt": "2026-04-18T20:19:29.734Z",
//             "updatedAt": "2026-04-18T20:19:29.734Z",
//             "__v": 0
//         },
//         "variants": [
//             {
//                 "productId": "69e3e75168e49ea690be0d4a",
//                 "sku": "SOAP-WHITE-001",
//                 "price": 10,
//                 "priceAfterDiscount": 8,
//                 "stock": 120,
//                 "sold": 0,
//                 "components": [],
//                 "label": "Default",
//                 "image": "https://example.com/images/soap-variant.jpg",
//                 "isActive": true,
//                 "isDeleted": false,
//                 "deletedAt": null,
//                 "_id": "69e3e75168e49ea690be0d4d",
//                 "__v": 0,
//                 "createdAt": "2026-04-18T20:19:29.915Z",
//                 "updatedAt": "2026-04-18T20:19:29.915Z"
//             }
//         ]
//     }
// }

// ------------------------------------------------------------------