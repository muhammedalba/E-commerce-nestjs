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
import { AggregationSyncService } from '../products-helper/aggregation-sync.service';

import { ProductFileService } from './products-file.service';
import { ProductSkuService } from './products-sku.service';
import { generateUniqueSlug } from 'src/shared/utils/slug.util';
import { sanitizePayload } from 'src/shared/utils/object.utils';
import { withTransactionRetry } from 'src/shared/utils/database.utils';
import { FileAsset } from 'src/shared/schema/file-asset.schema';
import { handleDuplicateKeyError } from '../products-helper/product-error.utils';
import { InventoryAlertService } from './inventory-alert.service';
import { normalizeVariantData } from '../shared/utils/data-normalizer';
import { withBaseUrl } from 'src/shared/utils/with-base-url.util';
import { RevalidationService } from 'src/shared/services/revalidation.service';
import { CacheInvalidationService } from 'src/shared/services/cache-invalidation.service';

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
    private readonly i18n: CustomI18nService,
    private readonly eventEmitter: EventEmitter2,
    private readonly inventoryAlertService: InventoryAlertService,
    private readonly revalidationService: RevalidationService,
    private readonly cacheInvalidation: CacheInvalidationService,
    private readonly aggregationSync: AggregationSyncService,
  ) {}

  /**
   * Expires the storefront's ISR cache for the product list and the given
   * product pages. Pass both old and new slugs when a slug changes.
   * Must only be called after the DB transaction has committed.
   */
  private async revalidateProducts(...slugs: (string | undefined)[]) {
    // Clear the backend response cache first: @ClearCache('products') on the
    // controller only runs after this method returns, and Next must not
    // revalidate against the stale cached response.
    // Best-effort: the DB write already committed, never fail the request here.
    await this.cacheInvalidation
      .clearResources(['products'])
      .catch((err: unknown) =>
        this.logger.error('Failed to clear products response cache', err),
      );
    return this.revalidationService.revalidate([
      'products',
      ...slugs.filter(Boolean).map((slug) => `product-${slug}`),
    ]);
  }

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
      // Awaited (not the async event): the response — and the dashboard's
      // immediate refetch — must see the final stockSummary / priceRange.
      await this.aggregationSync.syncProduct(newProduct._id);
      await this.revalidateProducts(newProduct.slug);
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
    // Transformed file tracking for precise rollback
    let uploadedFiles: {
      imageCover?: FileAsset | undefined;
      images?: (string | FileAsset)[] | undefined;
      infoProductPdf?: FileAsset | undefined;
    } | null = null;

    // 1. Sanitize Payload (Remove undefined fields/arrays gracefully)
    const cleanDto = sanitizePayload(updateProductDto);
    const { variants: variantOps, ...productData } = cleanDto;

    // ==========================================
    // PHASE 1: Fetch Current State
    // ==========================================
    // ARCHITECTURAL FIX: Removed .select() to ensure the doc is fully loaded.
    // This guarantees accurate hydration later for validation, and prevents data-loss scenarios.
    // Fetch the product by its ID and populate only active (non-deleted) variants.
    // - .populate(): Retrieves related ProductVariant documents matching the product.
    // - match: { isDeleted: { $ne: true } }: Excludes soft-deleted variants to maintain accurate counts and avoid ghost references.
    // - .lean(): Returns lightweight plain JavaScript objects to boost performance and reduce memory usage during read-only evaluations.
    const doc = await this.productModel
      .findById(idParamDto.id)
      .populate({
        path: 'variants',
        match: { isDeleted: { $ne: true } }, // CRITICAL: Consistently ignore soft-deleted variants
      })
      .lean();

    // Guard clause: If the product does not exist, fail immediately with a 404 Not Found exception.
    if (!doc) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }

    const effectiveAllowedAttributes =
      cleanDto.allowedAttributes || doc.allowedAttributes || [];

    // ==========================================
    // PHASE 2: In-Memory Validation (Fail-Fast)
    // ==========================================
    if (variantOps?.create && variantOps.create.length > 0) {
      // The number of simple variants for the product in the database is calculated—specifically, those variants that do not have any attributes.
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
      // Summary of Objective and Benefit
      // Support for Partial Updates: Allowing the modification of a single property without requiring the user to resend all existing properties.
      // 1. Retrieve the list of current product variants from the database
      const existingVariants = (doc.variants ?? []) as ProductVariantDocument[];

      // 2. Iterate over each variant to be updated
      const mergedForValidation = variantOps.update.map((incoming) => {
        const { _id, ...incomingData } = incoming;

        // 3. Search for the original variant stored in the database using _id
        const existingVariant = existingVariants.find(
          (v) => String(v._id) === String(_id),
        );

        // 4. Merge old attributes with new attributes (new overrides old)
        const mergedAttributes: Record<string, unknown> = {
          ...(existingVariant?.attributes ?? {}), // old
          ...(incomingData.attributes ?? {}), // new
        };

        // 5. Return the final form that the variant will take after being saved
        return { attributes: mergedAttributes };
      });
      // validates the attributes of multiple variants against the allowed attributes of the product. It ensures that all attributes are valid and in the correct format.
      this.skuService.validateVariantAttributes(
        mergedForValidation,
        effectiveAllowedAttributes,
        0,
        0,
      );
    }
    // 1. Did the user modify the allowed attribute rules for the product in this request? Check whether these old variables are still compatible with the new rules.
    if (cleanDto.allowedAttributes) {
      // 2. Filtering the current variables in the database to extract only the "constant variables":
      // This ensures we only validate the variables that were not explicitly part of an update or delete operation,
      // preventing conflicts between new rules and pending structural changes.
      const variantsToValidate =
        (doc.variants as ProductVariantDocument[])?.filter((v) => {
          // Is this variable sent in the edit list?
          const isBeingUpdated = variantOps?.update?.some(
            (u) => String(u._id) === String(v._id),
          );
          // Is this variable included in the deletion list?
          const isBeingDeleted = variantOps?.delete?.some(
            (d) => String(d) === String(v._id),
          );
          // Exclude variables that are modified or deleted
          return !isBeingUpdated && !isBeingDeleted;
        }) || [];

      // 3. If there are old variables remaining unchanged:
      if (variantsToValidate.length > 0) {
        // Check whether these old variables are still compatible with the new rules.
        this.skuService.validateVariantAttributes(
          variantsToValidate,
          cleanDto.allowedAttributes, // New rules to be memorized
          0,
          0,
        );
      }
    }

    // ==========================================
    // PHASE 3: DB-Light Logic (Slugs & SKUs)
    // ==========================================
    let newBaseSlug = doc.slug;
    // If the user has modified the product title, generate a new unique slug for it.
    if (productData.title) {
      newBaseSlug = await generateUniqueSlug(
        productData.title.en,
        this.productModel,
        doc._id,
        this.i18n.translate('exception.NAME_EXISTS'),
      );
      productData.slug = newBaseSlug;
    }

    // 3. If new variants are being added:
    // Pre-calculate and validate new variants BEFORE opening the transaction to minimize lock time
    let precomputedNewVariants: Record<string, unknown>[] = [];
    if (variantOps?.create && variantOps.create.length > 0) {
      // Generate and validate SKUs for the new variants.
      await this.skuService.generateAndValidateSkus(
        variantOps.create,
        newBaseSlug,
      );

      // During the seconds it took to upload the images in Stage 4,
      // another user (or a concurrent request) might have created
      // a variant with the same SKU and saved it to the database.
      // The `ensureUnique` check here acts as a final safeguard—a last-line
      // defensive check—immediately before the `insertMany` operation
      // to ensure that no collision (Duplicate Key Error) occurs.
      precomputedNewVariants = await Promise.all(
        variantOps.create.map(async (v) => {
          const normalized = normalizeVariantData(v);
          return {
            ...normalized,
            productId: doc._id,
            sku: normalized.sku
              ? await this.skuService.ensureUnique(normalized.sku)
              : undefined,
          };
        }),
      );

      // ARCHITECTURAL FIX: Explicitly validate before insertMany to guarantee safety.
      // Note: If schema utilizes complex pre('save') hooks, consider mapping into sequential .save() calls instead.
      const newVariantDocs = precomputedNewVariants.map(
        (data) => new this.variantModel(data),
      );
      for (const newDoc of newVariantDocs) {
        const valErr = newDoc.validateSync();
        if (valErr) {
          throw new BadRequestException(
            `Variant validation failed: ${valErr.message}`,
          );
        }
      }
    }

    // Pre-calculate and validate variant updates BEFORE opening the transaction
    const precomputedBulkUpdates: AnyBulkWriteOperation<ProductDocument>[] = [];
    const stockAlertVariantIds: string[] = [];

    if (variantOps?.update && variantOps.update.length > 0) {
      for (const variantUpdate of variantOps.update) {
        const { _id, ...rawUpdateData } = variantUpdate;
        const updateData = normalizeVariantData(rawUpdateData);
        if (updateData.sku) {
          updateData.sku = updateData.sku.toUpperCase();
        }

        // Searches for the variant in the pre-loaded data (doc.variants)
        // CRITICAL FIX: Document-aware bulk validation
        // We fetch the original plain object, hydrate it into a Mongoose doc, apply updates,
        // and validate. This accurately respects required fields, defaults, and cross-field logic.
        const originalState = (
          doc.variants as (ProductVariant & { _id: unknown })[]
        ).find((v) => String(v._id) === String(_id));

        if (!originalState) {
          throw new NotFoundException(`Variant ${_id} not found.`);
        }

        // Safe merging of nested objects
        // Isolated concern: safely merge partial shippingProfile if provided without overwriting attributes or vice-versa
        if (updateData.shippingProfile && originalState.shippingProfile) {
          updateData.shippingProfile = {
            ...originalState.shippingProfile,
            ...updateData.shippingProfile,
            dimensions:
              updateData.shippingProfile.dimensions ??
              originalState.shippingProfile.dimensions,
          };
        }

        // It takes a standard JS object and converts it in memory into a genuine Mongoose Document, without performing any database query.
        const validationDoc = this.variantModel.hydrate(originalState);
        // Apply updates
        validationDoc.set(updateData);

        // Validate
        // It validates the entire object against schema rules—such as whether the price is negative, an enum constraint is violated,
        // or a mandatory field is missing.
        // If any error is found, it immediately rejects the operation before interacting with the database.
        const validationError = validationDoc.validateSync();
        if (validationError) {
          throw new BadRequestException(
            `Validation failed for variant ${_id}: ${validationError.message}`,
          );
        }

        // CLEAR STOCK ALERT CACHE IF STOCK IS UPDATED (Queued for execution after commit)
        if ('stock' in updateData) {
          stockAlertVariantIds.push(String(_id));
        }

        precomputedBulkUpdates.push({
          updateOne: {
            filter: { _id, productId: doc._id },
            update: { $set: updateData }, // Optimistic Concurrency Note: If updateData includes __v, Mongoose applies it here.
          },
        });
      }
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
      Object.assign(productData, uploadedFiles);
    }

    // ==========================================
    // PHASE 5: Resilient DB Transaction
    // ==========================================
    try {
      const updatedProduct = await withTransactionRetry(
        async (session) => {
          // 1. Update Base Product
          // Check if there are any updates pending for the base product document.
          const hasProductUpdates = Object.keys(productData).length > 0;

          // Initialize productResult to null, which will hold the updated product document.
          let productResult: ProductDocument | null = null;

          // If there are pending updates for the base product
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
            if (precomputedNewVariants.length > 0) {
              await this.variantModel.insertMany(precomputedNewVariants, {
                session,
              });
            }

            // B. UPDATE Variants (BulkWrite with Context-Aware Validation)
            if (precomputedBulkUpdates.length > 0) {
              await this.variantModel.bulkWrite(precomputedBulkUpdates, {
                session,
              });
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
      if (!updatedProduct) {
        throw new InternalServerErrorException(
          'Transaction failed to return updated product.',
        );
      }

      // CLEAR STOCK ALERT CACHE strictly AFTER commit succeeds
      for (const variantId of stockAlertVariantIds) {
        this.inventoryAlertService
          .clearStockAlertCache(variantId)
          .catch((e) =>
            this.logger.error('Failed to clear stock alert cache', e),
          );
      }

      // Delete old files that are no longer needed, strictly after the transaction commits successfully.
      if (filesToDelete.length > 0) {
        void this.fileService.deleteFilesList(filesToDelete).catch((err) => {
          this.logger.error(
            'Failed to clean up old files after transaction commit',
            err,
          );
        });
      }

      // Event emission occurs strictly AFTER transaction commit succeeds
      await this.aggregationSync.syncProduct(updatedProduct._id);

      // Old slug too: a title change moves the product to a new URL
      await this.revalidateProducts(doc.slug, updatedProduct.slug);

      // Fetch final hydrated variants only if variant changes occurred; otherwise reuse doc.variants
      const hasVariantChanges = Boolean(
        variantOps &&
        ((variantOps.create && variantOps.create.length > 0) ||
          (variantOps.update && variantOps.update.length > 0) ||
          (variantOps.delete && variantOps.delete.length > 0)),
      );

      const finalVariants = hasVariantChanges
        ? await this.variantModel
            .find({
              productId: updatedProduct._id,
              isDeleted: { $ne: true },
            })
            .lean()
        : ((doc.variants ?? []) as ProductVariant[]);

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
    try {
      const deletedSlug = await withTransactionRetry(
        async (session) => {
          const now = new Date();

          const product = await this.productModel.findByIdAndUpdate(
            idParamDto.id,
            { $set: { isDeleted: true, deletedAt: now } },
            { new: true, session },
          );

          if (!product) {
            throw new BadRequestException(
              this.i18n.translate('exception.NOT_FOUND'),
            );
          }

          await this.variantModel.updateMany(
            { productId: product._id },
            { $set: { isDeleted: true, deletedAt: now } },
            { session },
          );

          return product.slug;
        },
        this.connection,
        this.logger,
      );

      await this.revalidateProducts(deletedSlug);

      return { message: 'Product and variants soft-deleted successfully' };
    } catch (error: unknown) {
      this.logger.error(
        'Transaction Error (delete product)',
        error instanceof Error ? error.stack : String(error),
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_DELETE'),
      );
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
      .select('slug imageCover infoProductPdf images')
      .lean();

    if (!doc) {
      throw new BadRequestException(
        'Product not found or not soft-deleted. Soft-delete first.',
      );
    }

    try {
      await withTransactionRetry(
        async (session) => {
          // Hard delete variants first, then product
          await this.variantModel.deleteMany(
            { productId: doc._id },
            { session },
          );
          await this.productModel.findByIdAndDelete(doc._id, { session });
        },
        this.connection,
        this.logger,
      );

      // Delete associated files only after successful commit
      await this.fileService.deleteProductFiles(doc);

      await this.revalidateProducts(doc.slug);

      return { message: 'Product and variants permanently deleted' };
    } catch (error: unknown) {
      this.logger.error(
        'Transaction Error (hard delete)',
        error instanceof Error ? error.stack : String(error),
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_DELETE'),
      );
    }
  }

  /*
   * @description this function will restore a product
   * @param idParamDto @description the id of the product to be restored
   * @returns @description the restored product
   */
  async restore(idParamDto: IdParamDto) {
    try {
      const product = await withTransactionRetry(
        async (session) => {
          const restoredProduct = await this.productModel.findOneAndUpdate(
            { _id: idParamDto.id, isDeleted: true },
            { $set: { isDeleted: false, deletedAt: null } },
            { new: true, session },
          );

          if (!restoredProduct) {
            throw new NotFoundException('Deleted product not found');
          }

          await this.variantModel.updateMany(
            { productId: restoredProduct._id, isDeleted: true },
            { $set: { isDeleted: false, deletedAt: null } },
            { session },
          );

          return restoredProduct;
        },
        this.connection,
        this.logger,
      );

      await this.revalidateProducts(product.slug);

      const variants = await this.variantModel
        .find({ productId: product._id })
        .lean();

      return {
        product: this.i18n.localize(product),
        variants,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        'Transaction Error (restore product)',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to restore product');
    }
  }
}
