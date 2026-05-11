import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  ORDER_PLACED = 'ORDER_PLACED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
}

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true })
  declare action: string;

  @Prop({ required: true })
  declare module: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  declare userId: string;

  @Prop({ default: '' })
  declare userEmail: string;

  @Prop({ type: Object })
  declare previousData: Record<string, any>;

  @Prop({ type: Object })
  declare newData: Record<string, any>;

  @Prop({ default: '' })
  declare ipAddress: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ module: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1 });
