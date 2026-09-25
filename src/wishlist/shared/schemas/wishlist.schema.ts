import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

@Schema({ timestamps: true })
export class Wishlist extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.USER,
    required: true,
    unique: true,
  })
  declare user: Types.ObjectId;

  /**
   * Product-level wishlist (no variant): the heart button is shown on product
   * cards before any variant is selected.
   */
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: MODEL_NAMES.PRODUCT }],
    default: [],
  })
  declare products: Types.ObjectId[];
}

export const WishlistSchema = SchemaFactory.createForClass(Wishlist);
