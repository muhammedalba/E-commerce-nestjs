import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Product, ProductDocument } from '../shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from '../shared/schemas/ProductVariant.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { CreateProductDto } from '../shared/dto/create-product.dto';
import { UpdateProductDto } from '../shared/dto/update-product.dto';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { MulterFilesType } from 'src/shared/utils/interfaces/fileInterface';
import { VariantChangedEvent } from '../products-helper/aggregation-sync.service';

import { ProductFileService } from './products-file.service';
import { ProductSkuService } from './products-sku.service';
import { ProductQueryService } from './products-query.service';
import { generateUniqueSlug } from 'src/shared/utils/slug.util';
import { I18nHelper } from 'src/shared/utils/i18n/i18n-helper';

/**
 * Handles all write operations: create, update, delete, restore.
 * Invalidates cache after every mutation.
 */
@Injectable()
export class ProductMutationService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<ProductVariantDocument>,
    @InjectConnection() private readonly connection: Connection,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly fileService: ProductFileService,
    private readonly skuService: ProductSkuService,
    private readonly queryService: ProductQueryService,
    private readonly i18n: CustomI18nService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  // ──────────────────────────────────────────────────────
  //  CACHE INVALIDATION
  // ──────────────────────────────────────────────────────

  /**
   * Clears the entire in-memory cache store.
   * Called after every mutation (create/update/delete/restore).
   */
  private async invalidateCache(): Promise<void> {
    try {
      await this.cacheManager.clear();
    } catch {
      // Silently ignore cache errors — they shouldn't block mutations
    }
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


    // 1) Validate attributes
    this.skuService.validateVariantAttributes(
      variants,
      createProductDto.allowedAttributes || [],
    );
    // 2) Generate slug
    productData.slug = await generateUniqueSlug(
      productData.title.en,
      this.productModel,
      undefined,
      this.i18n.translate('exception.NAME_EXISTS'),
    );
    // 3) Generate & Check SKUs
    await this.skuService.generateAndValidateSkus(variants, productData.slug);

    // 4) Handle file uploads
    const uploadedFiles = await this.fileService.handleCreateFiles(files);
    Object.assign(productData, uploadedFiles);

    // 5) Start Transaction
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const [newProduct] = await this.productModel.create(
        [productData as any],
        { session },
      );

      if (!newProduct) {
        throw new InternalServerErrorException('Failed to create product');
      }

      // Attach productId and ensure unique SKUs
      const variantDocs = variants.map((v) => ({
        ...v,
        productId: newProduct._id,
      }));

      for (const doc of variantDocs) {
        if (doc.sku) {
          doc.sku = await this.skuService.ensureUnique(doc.sku);
        }
      }
      const createdVariants = await this.variantModel.insertMany(
        variantDocs,
        { session },
      );

      await session.commitTransaction();

      // Emit async event for aggregation
      this.eventEmitter.emit(
        'variant.changed',
        new VariantChangedEvent(newProduct._id),
      );

      // Invalidate cache
      await this.invalidateCache();

      // Prepare response
      const baseUrl = process.env.BASE_URL || '';
      newProduct.imageCover = `${baseUrl}${productData.imageCover}`;
      newProduct.images = newProduct.images?.map(
        (img) => `${baseUrl}${img}`,
      );
      newProduct.infoProductPdf = productData.infoProductPdf
        ? `${baseUrl}${productData.infoProductPdf}`
        : undefined;

      return {
        product: I18nHelper.localize(newProduct),
        variants: createdVariants,
      };
    } catch (error: any) {
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
      .select('infoProductPdf imageCover images supCategories slug allowedAttributes ').populate('variants', 'attributes')
      .lean();

    if (!doc) {
      throw new BadRequestException(
        this.i18n.translate('exception.NOT_FOUND'),
      );
    }

    // 2) Handle slug change
    if (productData.title) {
      productData.slug = await generateUniqueSlug(
        productData.title.en,
        this.productModel,
        doc._id,
        this.i18n.translate('exception.NAME_EXISTS'),
      );
    }
    // 3) Validate variants against (new or existing) allowedAttributes
    const effectiveAllowedAttributes = updateProductDto.allowedAttributes || doc.allowedAttributes || [];
    
    if (variantOps?.create && variantOps.create.length > 0) {
      // Get current variants with their attributes to check for "Simple" variant count
      const existingSimpleCount = doc.variants?.filter(v => 
        !v.attributes || Object.keys(v.attributes).length === 0
      ).length || 0;

      this.skuService.validateVariantAttributes(
        variantOps.create,
        effectiveAllowedAttributes,
        doc?.variants?.length || 0,
        existingSimpleCount
      );

      const newBaseSlug = productData.slug || doc.slug;
      await this.skuService.generateAndValidateSkus(
        variantOps.create,
        newBaseSlug,
      );
    }

    if (variantOps?.update && variantOps.update.length > 0) {
      this.skuService.validateVariantAttributes(
        variantOps.update as any[],
        effectiveAllowedAttributes,
      );
      for (const v of variantOps.update) {
        if (v.sku) v.sku = v.sku.toUpperCase();
      }
    }

    // 4) If allowedAttributes are changing, validate all EXISTING variants that aren't being updated/deleted
    if (updateProductDto.allowedAttributes) {
      const variantsToValidate = (doc.variants as any[])?.filter(v => {
        const isBeingUpdated = variantOps?.update?.some(u => String(u._id) === String(v._id));
        const isBeingDeleted = variantOps?.delete?.some(d => String(d) === String(v._id));
        return !isBeingUpdated && !isBeingDeleted;
      }) || [];

      if (variantsToValidate.length > 0) {
        this.skuService.validateVariantAttributes(
          variantsToValidate as any[],
          updateProductDto.allowedAttributes,
          0, // we don't care about count here
          0  // we just want to ensure schema compliance
        );
      }
    }

    // 4) Handle file uploads
    if (files) {
      const fileUpdates = await this.fileService.handleUpdateFiles(
        doc,
        files,
        updateProductDto.images,
      );
      Object.assign(productData, fileUpdates);
    }

    // 5) Start Transaction
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Update product base fields
      if (updateProductDto.allowedAttributes) {
        (productData as any).allowedAttributes = updateProductDto.allowedAttributes;
      }
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
            productId: updatedProduct!._id,
          }));

          for (const varDoc of newVariants) {
            if (varDoc.sku) {
              varDoc.sku = await this.skuService.ensureUnique(varDoc.sku);
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

      await session.commitTransaction();

      // Emit event for aggregation sync
      this.eventEmitter.emit(
        'variant.changed',
        new VariantChangedEvent(updatedProduct._id),
      );

      // Invalidate cache
      await this.invalidateCache();

      // Fetch full updated state
      const finalVariants = await this.variantModel
        .find({ productId: updatedProduct._id })
        .lean();

      return {
        product: I18nHelper.localize(updatedProduct),
        variants: finalVariants,
      };
    } catch (error: any) {
      await session.abortTransaction();
      console.error('Transaction Error (update product):', error);

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      if (error.code === 11000) {
        throw new BadRequestException(
          this.i18n.translate('exception.NAME_EXISTS'),
        );
      }

      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    } finally {
      session.endSession();
    }
  }

  // ──────────────────────────────────────────────────────
  //  SOFT DELETE PRODUCT (Transaction)
  // ──────────────────────────────────────────────────────

  async remove(idParamDto: IdParamDto) {
    const doc = await this.productModel
      .findById(idParamDto.id)
      .select('_id')
      .lean();

    if (!doc) {
      throw new BadRequestException(
        this.i18n.translate('exception.NOT_FOUND'),
      );
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const now = new Date();

      await this.productModel.findByIdAndUpdate(
        idParamDto.id,
        { $set: { isDeleted: true, deletedAt: now } },
        { session },
      );

      await this.variantModel.updateMany(
        { productId: doc._id },
        { $set: { isDeleted: true, deletedAt: now } },
        { session },
      );

      await session.commitTransaction();

      // Invalidate cache
      await this.invalidateCache();

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
  //  HARD DELETE (admin-only)
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
      await this.fileService.deleteProductFiles(doc);

      // Hard delete variants first, then product
      await this.variantModel.deleteMany(
        { productId: doc._id },
        { session },
      );
      await this.productModel.findByIdAndDelete(doc._id, { session });

      await session.commitTransaction();

      // Invalidate cache
      await this.invalidateCache();

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

      // Invalidate cache
      await this.invalidateCache();

      const variants = await this.variantModel
        .find({ productId: product._id })
        .lean();

      return {
        product:  I18nHelper.localize(product),
        // product: this.queryService.localize(product),
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
