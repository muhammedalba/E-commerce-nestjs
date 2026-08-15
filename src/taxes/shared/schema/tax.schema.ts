import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

export type TaxDocument = HydratedDocument<Tax>;

/**
 * Defines the geographical scope of a tax rule.
 *
 * Resolution priority (most specific wins):
 *   city → region → country → global → settings fallback
 */
export enum TaxScope {
  GLOBAL = 'global',
  COUNTRY = 'country',
  REGION = 'region',
  CITY = 'city',
}

@Schema({ timestamps: true })
export class Tax {
  // ── Existing fields (unchanged) ─────────────────────────────────────────────

  @Prop({ required: true, default: 'VAT' })
  declare name: string;

  @Prop({ required: true, default: 15, min: 0, max: 100 })
  declare percentage: number;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: MODEL_NAMES.COUNTRY,
    required: false,
    default: null,
  })
  declare country: Types.ObjectId | null;

  @Prop({ default: '' })
  declare taxNumber: string;

  @Prop({ default: false })
  declare isIncludedInPrice: boolean;

  @Prop({ default: true })
  declare isActive: boolean;

  @Prop({ default: '' })
  declare description: string;

  // ── New fields added for Scope support ─────────────────────────────────────

  /**
   * Explicit scope of this tax rule.
   * Required on all new documents. Old documents are migrated via
   * the tax-scope.migration.ts script.
   */
  @Prop({
    type: String,
    enum: Object.values(TaxScope),
    required: true,
    default: TaxScope.GLOBAL,
  })
  declare scope: TaxScope;

  /**
   * Required when scope = 'region' or 'city'.
   * Must belong to `country`.
   */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: MODEL_NAMES.REGION,
    required: false,
    default: null,
  })
  declare region: Types.ObjectId | null;

  /**
   * Required when scope = 'city'.
   * Must belong to `region`.
   */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: MODEL_NAMES.CITY,
    required: false,
    default: null,
  })
  declare city: Types.ObjectId | null;
}

export const TaxSchema = SchemaFactory.createForClass(Tax);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
//
// All uniqueness constraints are scope-aware and only apply to ACTIVE taxes.
// We use partialFilterExpression so that inactive taxes do not block creation
// of new active rules.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GLOBAL: one active global tax per name.
 * (Mirrors the previous index behaviour for global taxes.)
 */
TaxSchema.index(
  { scope: 1 },
  {
    unique: true,
    partialFilterExpression: {
      scope: TaxScope.GLOBAL,
      isActive: true,
    },
    name: 'uniq_active_global_tax',
  },
);

/**
 * COUNTRY: one active tax per country.
 */
TaxSchema.index(
  { scope: 1, country: 1 },
  {
    unique: true,
    partialFilterExpression: {
      scope: TaxScope.COUNTRY,
      isActive: true,
    },
    name: 'uniq_active_country_tax',
  },
);

/**
 * REGION: one active tax per (country, region) pair.
 */
TaxSchema.index(
  { scope: 1, country: 1, region: 1 },
  {
    unique: true,
    partialFilterExpression: {
      scope: TaxScope.REGION,
      isActive: true,
    },
    name: 'uniq_active_region_tax',
  },
);

/**
 * CITY: one active tax per (country, region, city) triple.
 */
TaxSchema.index(
  { scope: 1, country: 1, region: 1, city: 1 },
  {
    unique: true,
    partialFilterExpression: {
      scope: TaxScope.CITY,
      isActive: true,
    },
    name: 'uniq_active_city_tax',
  },
);

/** General lookup index — used by findApplicableTax queries. */
TaxSchema.index({ scope: 1, isActive: 1 });
TaxSchema.index({ scope: 1, country: 1, isActive: 1 });
TaxSchema.index({ scope: 1, country: 1, region: 1, isActive: 1 });
TaxSchema.index({ scope: 1, country: 1, region: 1, city: 1, isActive: 1 });
