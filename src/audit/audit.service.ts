import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './shared/schema/audit-log.schema';

export interface CreateAuditLogDto {
  action: string;
  module: string;
  userId?: string;
  userEmail?: string;
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async log(dto: CreateAuditLogDto, session?: any): Promise<AuditLogDocument> {
    const [log] = await this.auditLogModel.create(
      [dto],
      session ? { session } : {},
    );
    return log;
  }

  async getLogsByModule(module: string, limit = 50): Promise<any[]> {
    return this.auditLogModel
      .find({ module })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async getLogsByUser(userId: string, limit = 50): Promise<any[]> {
    return this.auditLogModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}
