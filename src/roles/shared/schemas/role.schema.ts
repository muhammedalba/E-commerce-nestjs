import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';
import { Permissions } from '../enums/permissions.enum';


export type RoleDocument = HydratedDocument<Role>;
@Schema({ timestamps: true })
export class Role extends Document {
  @Prop({ required: true, unique: true, trim: true })
  declare name: string;

  @Prop({ required: true, trim: true })
  declare description: string;

  @Prop({ type: [String], enum: Object.values(Permissions), default: [] })
  declare permissions: Permissions[];

  @Prop({ default: false })
  declare isSystemDefined: boolean; // True for SuperAdmin, so it cannot be deleted/modified easily

  @Prop({ required: true, default: 0, min: 0, max: 100 })
  declare level: number; // 100 for SuperAdmin, 0 for regular users
}

export const RoleSchema = SchemaFactory.createForClass(Role);
