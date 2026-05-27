import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Connection, Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Product, ProductDocument } from '../shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from '../shared/schemas/ProductVariant.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { CreateProductDto } from '../shared/dto/create-product.dto';
import { UpdateProductDto } from '../shared/dto/update-product.dto';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { MulterFilesType } from 'src/shared/utils/interfaces/fileInterface';
import { VariantChangedEvent } from '../products-helper/aggregation-sync.service';

import { ProductFileService } from './products-file.service';
import { ProductSkuService } from './products-sku.service';
import { ProductQueryService } from './products-query.service';
import { generateUniqueSlug } from 'src/shared/utils/slug.util';
import { sanitizePayload } from 'src/shared/utils/object.utils';
import { withTransactionRetry } from 'src/shared/utils/database.utils';
import { handleDuplicateKeyError } from '../products-helper/product-error.utils';
import { InventoryAlertService } from './inventory-alert.service';

/**
 * Handles all write operations: create, update, delete, restore.
 * Invalidates cache after every mutation.
 */
@Injectable()
export class ProductMutationService {
  private readonly logger = new Logger(ProductMutationService.name);

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<ProductVariantDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly fileService: ProductFileService,
    private readonly skuService: ProductSkuService,
    private readonly queryService: ProductQueryService,
    private readonly i18n: CustomI18nService,
    private readonly eventEmitter: EventEmitter2,
    private readonly inventoryAlertService: InventoryAlertService,
  ) {}

  /**
   *
   * @param createProductDto
   * @param files   @description the file that will uploaded files
   * @returns    @description the product that will created
   */

  async create(
    createProductDto: CreateProductDto,
    files: {
      imageCover: MulterFilesType;
      images?: MulterFilesType;
      infoProductPdf?: MulterFilesType;
    },
  ) {
    const { variants, ...productData } = createProductDto;
    let uploadedFiles: any = null; // تعريف المتغير هنا ليسهل الوصول إليه في الـ catch

    // ==========================================
    // خط الدفاع الأول: العمليات السريعة (Fail-Fast)
    // ==========================================

    // 1. التحقق من السمات (Attributes)
    this.skuService.validateVariantAttributes(
      variants,
      createProductDto.allowedAttributes || [],
    );

    // 2. توليد Slug والتحقق من الـ SKUs (عمليات سريعة في قاعدة البيانات)
    // نقوم بها قبل رفع الملفات، لتوفير الباندويث والمساحة إذا كان هناك خطأ
    productData.slug = await generateUniqueSlug(
      productData.title?.en,
      this.productModel,
      undefined,
      this.i18n.translate('exception.NAME_EXISTS'),
    );
    await this.skuService.generateAndValidateSkus(variants, productData.slug);

    // ==========================================
    // المرحلة الثانية: العمليات المكلفة (رفع الملفات)
    // ==========================================

    // 3. الآن فقط نقوم برفع الملفات (لأننا تأكدنا أن البيانات الأساسية سليمة)
    uploadedFiles = await this.fileService.handleCreateFiles(files);
    Object.assign(productData, uploadedFiles);

    // ==========================================
    // المرحلة الثالثة: الحفظ النهائي (Transaction)
    // ==========================================

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const [newProduct] = await this.productModel.create(
        [productData as any],
        { session },
      );

      if (!newProduct)
        throw new InternalServerErrorException('Failed to create product');

      // 4. تجهيز المتغيرات بالتوازي (لأننا فحصنا الـ SKUs مسبقاً)
      const variantDocs = await Promise.all(
        variants.map(async (v) => ({
          ...v,
          productId: newProduct._id,
          sku: v.sku ? await this.skuService.ensureUnique(v.sku) : undefined,
        })),
      );

      const createdVariants = await this.variantModel.insertMany(variantDocs, {
        session,
      });

      await session.commitTransaction();
      // 5. الأحداث وتجهيز الرد
      this.eventEmitter.emit(
        'variant.changed',
        new VariantChangedEvent(newProduct._id),
      );

      const baseUrl = process.env.BASE_URL || '';
      const productResponse = newProduct.toObject();

      productResponse.imageCover = `${baseUrl}${productResponse.imageCover}`;
      if (productResponse.images?.length) {
        productResponse.images = productResponse.images.map(
          (img) => `${baseUrl}${img}`,
        );
      }
      if (productResponse.infoProductPdf) {
        productResponse.infoProductPdf = `${baseUrl}${productResponse.infoProductPdf}`;
      }

      return {
        product: this.i18n.localize(productResponse),
        variants: createdVariants,
      };
    } catch (error: any) {
      // تراجع عن عمليات قاعدة البيانات
      await session.abortTransaction();
      this.logger.error(
        'Transaction Error (create product)',
        error?.stack || error,
      );

      // ==========================================
      // خط الدفاع الثاني: تنظيف الملفات اليتيمة (Rollback)
      // ==========================================
      // إذا تم رفع الملفات لكن حدث خطأ في قاعدة البيانات، نقوم بمسحها
      if (uploadedFiles) {
        try {
          // تأكد من إضافة دالة مثل deleteFiles في fileService الخاص بك
          await this.fileService.deleteProductFiles(uploadedFiles);
          this.logger.log(
            'Orphaned files deleted successfully due to transaction failure.',
          );
        } catch (cleanupError) {
          this.logger.error('Failed to clean up orphaned files', cleanupError);
        }
      }

      if (error.code === 11000) {
        throw new ConflictException(
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

  /*
   * @description this function will update a product
   * @param idParamDto @description the id of the product to be updated
   * @param updateProductDto @description the data of the product to be updated
   * @param files @description the files of the product to be updated
   * @returns @description the updated product
   */

  async update(
    idParamDto: IdParamDto,
    updateProductDto: UpdateProductDto,
    files: {
      imageCover?: MulterFilesType;
      infoProductPdf?: MulterFilesType;
      images?: MulterFilesType;
    },
  ) {
    // 1. Sanitize Payload (Remove undefined fields/arrays gracefully)
    const cleanDto = sanitizePayload(updateProductDto);
    const { variants: variantOps, ...productData } = cleanDto;

    // Transformed file tracking for precise rollback
    let uploadedFiles: any = null;

    // ==========================================
    // PHASE 1: Fetch Current State
    // ==========================================
    // ARCHITECTURAL FIX: Removed .select() to ensure the doc is fully loaded.
    // This guarantees accurate hydration later for validation, and prevents data-loss scenarios.
    // Using .lean() here is safe because this snapshot is purely read-only logic evaluation.
    const doc = await this.productModel
      .findById(idParamDto.id)
      .populate({
        path: 'variants',
        match: { isDeleted: { $ne: true } }, // CRITICAL: Consistently ignore soft-deleted variants
      })
      .lean();

    if (!doc) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }

    const effectiveAllowedAttributes =
      cleanDto.allowedAttributes || doc.allowedAttributes || [];

    // ==========================================
    // PHASE 2: In-Memory Validation (Fail-Fast)
    // ==========================================
    if (variantOps?.create && variantOps.create.length > 0) {
      const existingSimpleCount =
        doc.variants?.filter(
          (v: any) => !v.attributes || Object.keys(v.attributes).length === 0,
        ).length || 0;

      this.skuService.validateVariantAttributes(
        variantOps.create,
        effectiveAllowedAttributes,
        doc.variants?.length || 0,
        existingSimpleCount,
      );
    }

    if (cleanDto.allowedAttributes) {
      const variantsToValidate =
        (doc.variants as any[])?.filter((v) => {
          const isBeingUpdated = variantOps?.update?.some(
            (u) => String(u._id) === String(v._id),
          );
          const isBeingDeleted = variantOps?.delete?.some(
            (d) => String(d) === String(v._id),
          );
          return !isBeingUpdated && !isBeingDeleted;
        }) || [];

      if (variantsToValidate.length > 0) {
        this.skuService.validateVariantAttributes(
          variantsToValidate,
          cleanDto.allowedAttributes,
          0,
          0,
        );
      }
    }

    // ==========================================
    // PHASE 3: DB-Light Logic (Slugs & SKUs)
    // ==========================================
    let newBaseSlug = doc.slug;

    if (productData.title) {
      newBaseSlug = await generateUniqueSlug(
        productData.title.en,
        this.productModel,
        doc._id,
        this.i18n.translate('exception.NAME_EXISTS'),
      );
      productData.slug = newBaseSlug;
    }

    if (variantOps?.create && variantOps.create.length > 0) {
      await this.skuService.generateAndValidateSkus(
        variantOps.create,
        newBaseSlug,
      );
    }

    // ==========================================
    // PHASE 4: I/O & File Operations
    // ==========================================
    // ARCHITECTURAL NOTE: File uploads intentionally occur BEFORE the transaction retry block.
    // File I/O is not idempotent. If placed inside the retry block, transient DB failures
    // would trigger duplicate file uploads.
    if (files) {
      uploadedFiles = await this.fileService.handleUpdateFiles(
        doc,
        files,
        cleanDto.images,
      );
      Object.assign(productData, uploadedFiles);
    }

    // ==========================================
    // PHASE 5: Resilient DB Transaction
    // ==========================================
    try {
      const updatedProduct = await withTransactionRetry(
        async (session) => {
          // 1. Update Base Product
          const hasProductUpdates = Object.keys(productData).length > 0;
          let productResult: any = doc;

          if (hasProductUpdates) {
            // CRITICAL FIX: Removed .lean() so Mongoose virtuals, getters, and transforms
            // (needed by localization decorators/interceptors) remain intact in the response.
            productResult = await this.productModel.findByIdAndUpdate(
              idParamDto.id,
              { $set: productData },
              { new: true, runValidators: true, session },
            );
          } else {
            productResult = await this.productModel
              .findById(idParamDto.id)
              .session(session);
          }

          // 2. Sequential Variant Operations (Prevents MongoDB WriteConflict Error 112)
          if (variantOps) {
            // A. CREATE Variants
            if (variantOps.create && variantOps.create.length > 0) {
              const newVariantsData = await Promise.all(
                variantOps.create.map(async (v) => ({
                  ...v,
                  productId: productResult._id,
                  sku: v.sku
                    ? await this.skuService.ensureUnique(v.sku)
                    : undefined,
                })),
              );

              // ARCHITECTURAL FIX: Explicitly validate before insertMany to guarantee safety.
              // Note: If schema utilizes complex pre('save') hooks, consider mapping into sequential .save() calls instead.
              const newVariantDocs = newVariantsData.map(
                (data) => new this.variantModel(data),
              );
              for (const newDoc of newVariantDocs) {
                const valErr = newDoc.validateSync();
                if (valErr)
                  throw new BadRequestException(
                    `Variant validation failed: ${valErr.message}`,
                  );
              }
              await this.variantModel.insertMany(newVariantsData, { session });
            }

            // B. UPDATE Variants (BulkWrite with Context-Aware Validation)
            if (variantOps.update && variantOps.update.length > 0) {
              const bulkUpdates: AnyBulkWriteOperation<ProductDocument>[] = [];

              for (const variantUpdate of variantOps.update) {
                const { _id, ...updateData } = variantUpdate;
                if (updateData.sku)
                  updateData.sku = updateData.sku.toUpperCase();

                // CRITICAL FIX: Document-aware bulk validation
                // We fetch the original plain object, hydrate it into a Mongoose doc, apply updates,
                // and validate. This accurately respects required fields, defaults, and cross-field logic.
                const originalState = (doc.variants as any[]).find(
                  (v: any) => String(v._id) === String(_id),
                );
                if (!originalState)
                  throw new NotFoundException(`Variant ${_id} not found.`);

                const validationDoc = this.variantModel.hydrate(originalState);
                validationDoc.set(updateData);

                const validationError = validationDoc.validateSync();
                if (validationError) {
                  throw new BadRequestException(
                    `Validation failed for variant ${_id}: ${validationError.message}`,
                  );
                }

                // CLEAR STOCK ALERT CACHE IF STOCK IS UPDATED
                if ('stock' in updateData) {
                  this.inventoryAlertService
                    .clearStockAlertCache(String(_id))
                    .catch((e) =>
                      this.logger.error('Failed to clear stock alert cache', e),
                    );
                }

                bulkUpdates.push({
                  updateOne: {
                    filter: { _id, productId: productResult._id },
                    update: { $set: updateData }, // Optimistic Concurrency Note: If updateData includes __v, Mongoose applies it here.
                  },
                });
              }

              await this.variantModel.bulkWrite(bulkUpdates, { session });
            }

            // C. DELETE Variants
            if (variantOps.delete && variantOps.delete.length > 0) {
              await this.variantModel.updateMany(
                {
                  _id: { $in: variantOps.delete },
                  productId: productResult._id,
                },
                { $set: { isDeleted: true, deletedAt: new Date() } },
                { session },
              );
            }

            // D. Integrity Check
            const remainingCount = await this.variantModel
              .countDocuments({
                productId: productResult._id,
                isDeleted: { $ne: true },
              })
              .session(session);

            if (remainingCount === 0) {
              throw new BadRequestException(
                'Cannot delete all variants. A product must have at least one active variant.',
              );
            }
          }

          return productResult;
        },
        this.connection,
        this.logger,
      );

      // ==========================================
      // PHASE 6: Events & Final Response
      // ==========================================
      // Event emission occurs strictly AFTER transaction commit succeeds
      this.eventEmitter.emit(
        'variant.changed',
        new VariantChangedEvent(updatedProduct._id),
      );

      // Fetch final hydrated variants (without lean) to support response/localization layers
      const finalVariants = await this.variantModel.find({
        productId: updatedProduct._id,
        isDeleted: { $ne: true },
      });

      return {
        product: this.i18n.localize(updatedProduct),
        variants: finalVariants,
      };
    } catch (error: any) {
      // ==========================================
      // ROLLBACK & ERROR TRANSLATION
      // ==========================================
      // CRITICAL FIX: Only delete the transformed files (uploadedFiles) created during this request.
      // Never pass raw `files` to cleanup, as it might bypass metadata mapping and delete the wrong assets.
      if (uploadedFiles) {
        try {
          await this.fileService.deleteProductFiles(uploadedFiles);
          this.logger.log(
            'Rolled back newly uploaded files due to transaction failure.',
          );
        } catch (cleanupError) {
          this.logger.error(
            'Failed to cleanup files during update rollback',
            cleanupError,
          );
        }
      }

      this.logger.error(
        'Transaction Error (update product)',
        error?.stack || error,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      if (error.code === 11000) {
        handleDuplicateKeyError(error, this.i18n); // Precise duplicate error translation
      }

      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }
  }

  /*
   * @description this function will remove a product
   * @param idParamDto @description the id of the product to be removed
   * @returns @description the removed product
   */
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

      return { message: 'Product and variants soft-deleted successfully' };
    } catch (error: any) {
      await session.abortTransaction();
      this.logger.error(
        'Transaction Error (delete product)',
        error?.stack || error,
      );
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_DELETE'),
      );
    } finally {
      session.endSession();
    }
  }
  /*
   * @description this function will hard remove a product
   * @param idParamDto @description the id of the product to be hard removed
   * @returns @description the hard removed product
   */
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
      await this.variantModel.deleteMany({ productId: doc._id }, { session });
      await this.productModel.findByIdAndDelete(doc._id, { session });

      await session.commitTransaction();

      // Invalidate cache

      return { message: 'Product and variants permanently deleted' };
    } catch (error: any) {
      await session.abortTransaction();
      this.logger.error(
        'Transaction Error (hard delete)',
        error?.stack || error,
      );
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_DELETE'),
      );
    } finally {
      session.endSession();
    }
  }

  /*
   * @description this function will restore a product
   * @param idParamDto @description the id of the product to be restored
   * @returns @description the restored product
   */
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

      const variants = await this.variantModel
        .find({ productId: product._id })
        .lean();

      return {
        product: this.i18n.localize(product),
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
