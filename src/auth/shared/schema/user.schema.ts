import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Exclude } from 'class-transformer';
import slugify from 'slugify';
import { generateUniqueSlug } from 'src/shared/utils/slug.util';

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
  name!: string;

  @Prop({
    type: 'string',
    trim: true,
    lowercase: true,
  })
  slug?: string;

  @Prop({
    required: true,
    type: 'string',
    trim: true,
    isEmail: true,
    unique: true,
  })
  email!: string;

  @Prop({
    required: false,
    trim: true,
    type: 'string',
    minlength: [10, 'phone must be a least 10 characters'],
    maxlength: [18, 'phone must be a maximum of 18 characters'],
  })
  phone?: string;

  @Prop({
    required: true,
    trim: true,
    type: 'string',
    minlength: [6, 'password must be a least 8 characters'],
    maxlength: [100, 'password must be a maximum of 100 characters'],
    select: false,
  })
  @Exclude()
  password!: string;

  @Prop({
    required: false,
    lowercase: true,
    type: 'string',
    enum: ['user', 'admin', 'manager'],
    default: 'user',
  })
  @Exclude()
  role?: 'user' | 'admin' | 'manager';

  @Exclude()
  @Prop({
    required: false,
    type: Boolean,
    default: undefined,
  })
  verificationCode?: boolean;

  @Prop({
    required: false,
    type: Number,
    default: undefined,
  })
  passwordResetExpires?: number;

  @Prop({ type: Date, default: null })
  lastEmailAttemptAt?: Date;

  @Prop({ type: Date, default: null })
  lastLogin?: Date;

  @Prop({
    required: false,
    type: Number,
    default: 0,
  })
  totalOrder?: number;

  @Prop({
    required: false,
    type: 'string',
    default: undefined,
  })
  passwordResetCode?: string;

  @Prop({
    required: false,
    type: 'date',
    default: undefined,
  })
  passwordChangeAt?: Date;

  @Prop({
    required: false,
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  avatar?: string;

  @Prop({
    required: false,
    type: 'string',
    default: 'auth',
    trim: true,
  })
  provider?: string;

  @Prop({
    required: false,
    type: Boolean,
    default: true,
  })
  isActive?: boolean;
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
  // if (this.isModified('name') && this.name) {
  //   const nameValue = this.name.trim();
  //   // generate a unique slug
  //   const model = this.constructor as Model<User>;
  //   this.slug = await generateUniqueSlug(nameValue, model);
  // }
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
    // Check if the name field is being updated
    // if (update?.$set?.name && typeof update.$set.name === 'string') {
    //   const nameValue: string = update.$set.name;
    //   //
    //   const model = this.model as Model<User>;
    //   // Extract current document _id to exclude it from slug uniqueness check
    //   const conditions = this.getQuery();
    //   const excludeId = conditions._id ?? conditions.id ?? undefined;
    //   // generate a unique slug (excluding current doc so its own slug isn't flagged)
    //   const newSlug = await generateUniqueSlug(nameValue, model, excludeId);
    //   update.slug = newSlug;
    //   this.setUpdate(update);
    // }
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
UserSchema.post('init', function (doc) {
  if (doc.avatar && doc.name) {
    if (!doc.avatar.startsWith(process.env.BASE_URL ?? 'http')) {
      doc.avatar = `${process.env.BASE_URL}${doc.avatar}`;
    }
  }
});
