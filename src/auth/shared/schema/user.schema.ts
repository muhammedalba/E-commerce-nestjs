import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Exclude } from 'class-transformer';
import { Role } from 'src/roles/shared/schemas/role.schema';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

@Schema({ timestamps: true })
export class User {
  @Prop({
    type: 'string',
    trim: true,
    unique: false,
    required: true,
    minlength: [4, 'name must be a least 4 characters'],
    maxlength: [30, 'name must be a maximum of 30 characters'],
  })
  declare name: string;

  @Prop({
    type: 'string',
    trim: true,
    lowercase: true,
    index: true,
  })
  declare slug: string | undefined;

  @Prop({
    required: true,
    type: 'string',
    trim: true,
    isEmail: true,
    unique: true,
  })
  declare email: string;

  @Prop({
    required: false,
    trim: true,
    type: 'string',
    minlength: [10, 'phone must be a least 10 characters'],
    maxlength: [18, 'phone must be a maximum of 18 characters'],
  })
  declare phone: string | undefined;

  @Prop({
    required: true,
    trim: true,
    type: 'string',
    minlength: [6, 'password must be a least 8 characters'],
    maxlength: [100, 'password must be a maximum of 100 characters'],
    select: false,
  })
  @Exclude()
  declare password: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: MODEL_NAMES.ROLE })
  @Exclude()
  declare role: Types.ObjectId | Role;

  @Exclude()
  @Prop({
    required: false,
    type: Boolean,
    default: undefined,
  })
  declare verificationCode: boolean | undefined;

  @Prop({
    required: false,
    type: Number,
    default: undefined,
  })
  declare passwordResetExpires: number | undefined;

  @Prop({ type: Date, default: null })
  declare lastEmailAttemptAt: Date | undefined;

  @Prop({ type: Date, default: null })
  declare lastLogin: Date | undefined;

  @Prop({
    required: false,
    type: Number,
    default: 0,
  })
  declare totalOrder: number | undefined;

  @Prop({
    required: false,
    type: 'string',
    default: undefined,
  })
  declare passwordResetCode: string | undefined;

  @Prop({
    required: false,
    type: 'date',
    default: undefined,
  })
  declare passwordChangeAt: Date | undefined;

  @Prop({
    required: false,
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  declare avatar: string | undefined;

  @Prop({
    required: false,
    type: 'string',
    default: 'auth',
    trim: true,
  })
  declare provider: string | undefined;

  @Prop({
    required: false,
    type: Boolean,
    default: true,
  })
  declare isActive: boolean | undefined;
}
export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
// ─── Auto-exclude soft-deleted documents ─────────────────
UserSchema.pre(['find', 'countDocuments'], function () {
  if (this.getFilter().isActive === undefined) {
    this.where({ isActive: { $ne: false } });
  }
});
// Hook for hashing password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  if (typeof this.password === 'string') {
    const saltOrRounds = process.env.saltOrRounds || '10';
    const hash = await bcrypt.hash(this.password, parseInt(saltOrRounds, 10));
    this.password = hash;
  }

  next();
});

// for update one and find update
UserSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (update && typeof update === 'object' && '$set' in update) {
    // Check if the password field is being updated
    if (update?.$set?.password && typeof update.$set.password === 'string') {
      const saltOrRounds = process.env.saltOrRounds || '10';
      const hash = await bcrypt.hash(
        update?.$set?.password,
        parseInt(saltOrRounds, 10),
      );
      update.password = hash;
      update.passwordChangeAt = new Date();
    }
  }

  next();
});

//update , findOne and findAll
// UserSchema.post('init', function (doc) {
//   if (doc.avatar && doc.name) {
//     if (!doc.avatar.startsWith(process.env.BASE_URL ?? 'http')) {
//       doc.avatar = `${process.env.BASE_URL}${doc.avatar}`;
//     }
//   }
// });
