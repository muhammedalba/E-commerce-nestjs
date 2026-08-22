import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { HydratedDocument } from 'mongoose';
import { FileAsset } from 'src/shared/schema/file-asset.schema';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

@Schema({ timestamps: true })
export class Brand {
  @Prop({ type: Object, required: true })
  @IsDefined()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  declare name: FieldLocalizeDto;

  @Prop({
    type: 'string',
    trim: true,
    lowercase: true,
  })
  declare slug: string | undefined;

  @Prop({
    required: false,
    type: Object,
    default: { url: 'default.png', publicId: 'default.png', provider: 'local' },
  })
  declare image: FileAsset;
}
export type BrandDocument = HydratedDocument<Brand>;
export const BrandSchema = SchemaFactory.createForClass(Brand);

// Enforce uniqueness at the database level to prevent race conditions
// under high concurrency (avoids the TOCTOU gap in manual exists() + create() checks).
BrandSchema.index({ 'name.en': 1 }, { unique: true, sparse: true });
BrandSchema.index({ slug: 1 }, { unique: true, sparse: true });
