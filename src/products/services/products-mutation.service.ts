import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Connection, Model } from 'mongoose';
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
import { FileAsset } from 'src/shared/schema/file-asset.schema';
import { handleDuplicateKeyError } from '../products-helper/product-error.utils';
import { InventoryAlertService } from './inventory-alert.service';
import { normalizeVariantData } from '../shared/utils/data-normalizer';
import { withBaseUrl } from 'src/shared/utils/with-base-url.util';

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

    let uploadedFiles: {
      imageCover?: FileAsset | undefined;
      images?: FileAsset[] | undefined;
      infoProductPdf?: FileAsset | undefined;
    } | null = null; // Defining the variable here does not mean accessing it within the `catch` block.

    // ==========================================
    // First Line of Defense: Rapid Operations (Fail-Fast)
    // ==========================================

    // 1) It performs checks to prevent the creation of multiple variants without attributes and blocks the creation of more than one alternative for a product that lacks specific characteristics.
    // Validates multiple variants against the product's allowed attributes definition.
    // Also normalizes attributes in place before validation, to ensure keys/units map correctly.
    this.skuService.validateVariantAttributes(
      variants,
      createProductDto.allowedAttributes || [],
    );

    // 2) generate Slug and validate SKUs (rapid database operations)
    // performed before uploading files to save bandwidth and space if there is an error
    productData.slug = await generateUniqueSlug(
      productData.title?.en,
      this.productModel,
      undefined,
      this.i18n.translate('exception.NAME_EXISTS'),
    );
    // generate sku for each variant
    await this.skuService.generateAndValidateSkus(variants, productData.slug);

    // ==========================================
    // Second Line of Defense: Costly Operations (File Upload)
    // ==========================================

    // 3. Now only upload the files (since we have confirmed that the basic data is correct)
    uploadedFiles = await this.fileService.handleCreateFiles(files);
    // here i will use Object.assign to assign the uploaded files to the productData
    Object.assign(productData, uploadedFiles);

    // ==========================================
    // Third Line of Defense: Final Save (Transaction)
    // ==========================================

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const [newProduct] = await this.productModel.create([productData], {
        session,
      });

      if (!newProduct)
        throw new InternalServerErrorException('Failed to create product');

      // Prepare variants in parallel (SKUs already generated & validated in generateAndValidateSkus)
      const variantDocs = variants.map((v) => ({
        ...normalizeVariantData(v),
        productId: newProduct._id,
      }));

      const createdVariants = await this.variantModel.insertMany(variantDocs, {
        session,
      });

      await session.commitTransaction();
      // 5. Events and preparing the response
      // used to recalculate the aggregate statistics stored directly on the product document
      this.eventEmitter.emit(
        'variant.changed',
        new VariantChangedEvent(newProduct._id),
      );
      // Convert to a plain JS object to safely mutate properties (like URLs) without affecting the Mongoose Document state
      const productResponse = newProduct.toObject();
      // make an absolute url for each file in the product and return the product
      productResponse.imageCover = withBaseUrl(productResponse.imageCover);
      if (productResponse.images?.length) {
        productResponse.images = withBaseUrl(productResponse.images);
      }
      if (productResponse.infoProductPdf) {
        productResponse.infoProductPdf = withBaseUrl(
          productResponse.infoProductPdf,
        );
      }

      return {
        product: this.i18n.localize(productResponse),
        variants: createdVariants,
      };
    } catch (error: unknown) {
      // تراجع عن عمليات قاعدة البيانات
      await session.abortTransaction();
      this.logger.error(
        'Transaction Error (create product)',
        error instanceof Error ? error.stack : error,
      );

      // ==========================================
      // Rollback: delete orphaned files
      // ==========================================
      if (uploadedFiles) {
        try {
          await this.fileService.deleteProductFiles(uploadedFiles);
          this.logger.log(
            'Orphaned files deleted successfully due to transaction failure.',
          );
        } catch (cleanupError) {
          this.logger.error('Failed to clean up orphaned files', cleanupError);
        }
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        (error as Record<string, unknown>).code === 11000
      ) {
        throw new ConflictException(
          this.i18n.translate('exception.NAME_EXISTS'),
        );
      }

      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    } finally {
      await session.endSession();
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

    console.log('variants', variantOps?.create);
    // Transformed file tracking for precise rollback
    let uploadedFiles: {
      imageCover?: FileAsset | undefined;
      images?: (string | FileAsset)[] | undefined;
      infoProductPdf?: FileAsset | undefined;
    } | null = null;

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
          (v: ProductVariant) =>
            !v.attributes || Object.keys(v.attributes).length === 0,
        ).length || 0;
      //  It performs checks to prevent the creation of multiple variants without attributes and blocks the creation of more than one alternative for a product that lacks specific characteristics.
      // Validates multiple variants against the product's allowed attributes definition.
      // Also normalizes attributes in place before validation, to ensure keys/units map correctly.
      this.skuService.validateVariantAttributes(
        variantOps.create,
        effectiveAllowedAttributes,
        doc.variants?.length || 0,
        existingSimpleCount,
      );
    }

    // BIZ-PROD-01 FIX: Validate attributes of variants being *updated* against allowedAttributes.
    // We merge the current DB state of each variant with the incoming update payload to produce
    // the "post-update" picture, then run the same attribute validator used for creation.
    if (variantOps?.update && variantOps.update.length > 0) {
      const existingVariants = (doc.variants ?? []) as unknown as Array<{
        _id: unknown;
        attributes?: Record<string, unknown>;
      }>;

      const mergedForValidation = variantOps.update.map((incoming) => {
        const { _id, ...incomingData } = incoming;
        const existingVariant = existingVariants.find(
          (v) => String(v._id) === String(_id),
        );
        const mergedAttributes: Record<string, unknown> = {
          ...(existingVariant?.attributes ?? {}),
          ...(incomingData.attributes ?? {}),
        };
        return { attributes: mergedAttributes };
      });

      this.skuService.validateVariantAttributes(
        mergedForValidation,
        effectiveAllowedAttributes,
        0,
        0,
      );
    }

    if (cleanDto.allowedAttributes) {
      const variantsToValidate =
        (doc.variants as ProductVariantDocument[])?.filter((v) => {
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
    let filesToDelete: (FileAsset | string)[] = [];
    if (files) {
      const fileResult = await this.fileService.handleUpdateFiles(
        doc,
        files,
        cleanDto.images,
      );
      uploadedFiles = fileResult.updates;
      filesToDelete = fileResult.filesToDelete;
      console.log('update product ', uploadedFiles);
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
          let productResult: ProductDocument | null = null;

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

          if (!productResult) {
            throw new NotFoundException(
              this.i18n.translate('exception.NOT_FOUND'),
            );
          }

          // 2. Sequential Variant Operations (Prevents MongoDB WriteConflict Error 112)
          if (variantOps) {
            // A. CREATE Variants
            if (variantOps.create && variantOps.create.length > 0) {
              const newVariantsData = await Promise.all(
                variantOps.create.map(async (v) => {
                  const normalized = normalizeVariantData(v);
                  return {
                    ...normalized,
                    productId: productResult._id,
                    sku: normalized.sku
                      ? await this.skuService.ensureUnique(normalized.sku)
                      : undefined,
                  };
                }),
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
                const { _id, ...rawUpdateData } = variantUpdate;
                const updateData = normalizeVariantData(rawUpdateData);
                if (updateData.sku)
                  updateData.sku = updateData.sku.toUpperCase();

                // CRITICAL FIX: Document-aware bulk validation
                // We fetch the original plain object, hydrate it into a Mongoose doc, apply updates,
                // and validate. This accurately respects required fields, defaults, and cross-field logic.
                const originalState = (
                  doc.variants as (ProductVariant & { _id: unknown })[]
                ).find((v) => String(v._id) === String(_id));
                if (!originalState)
                  throw new NotFoundException(`Variant ${_id} not found.`);

                // Isolated concern: safely merge partial shippingProfile if provided without overwriting attributes or vice-versa
                if (
                  updateData.shippingProfile &&
                  originalState.shippingProfile
                ) {
                  updateData.shippingProfile = {
                    ...originalState.shippingProfile,
                    ...updateData.shippingProfile,
                    dimensions:
                      updateData.shippingProfile.dimensions ??
                      originalState.shippingProfile.dimensions,
                  };
                }

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

      // Delete old files that are no longer needed, strictly after the transaction commits successfully.
      if (filesToDelete.length > 0) {
        void this.fileService.deleteFilesList(filesToDelete).catch((err) => {
          this.logger.error(
            'Failed to clean up old files after transaction commit',
            err,
          );
        });
      }

      // ==========================================
      // PHASE 6: Events & Final Response
      // ==========================================
      if (!updatedProduct) {
        throw new InternalServerErrorException(
          'Transaction failed to return updated product.',
        );
      }

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
        error instanceof Error ? error.stack : String(error),
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      if ((error as { code?: number })?.code === 11000) {
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
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_DELETE'),
      );
    } finally {
      await session.endSession();
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
      // Hard delete variants first, then product
      await this.variantModel.deleteMany({ productId: doc._id }, { session });
      await this.productModel.findByIdAndDelete(doc._id, { session });

      await session.commitTransaction();

      // Delete associated files only after successful commit
      await this.fileService.deleteProductFiles(doc);

      // Invalidate cache

      return { message: 'Product and variants permanently deleted' };
    } catch (error: any) {
      await session.abortTransaction();
      this.logger.error(
        'Transaction Error (hard delete)',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_DELETE'),
      );
    } finally {
      await session.endSession();
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
      await session.endSession();
    }
  }
}
