import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './shared/schema/audit-log.schema';
import {
  AUDIT_DEFAULT_PAGE_LIMIT,
  redactSensitive,
} from './shared/audit.constants';
import { AuditLogQueryDto } from './shared/dto/audit-log-query.dto';

export interface CreateAuditLogDto {
  action: string;
  module: string;
  userId?: string;
  userEmail?: string;
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
  ipAddress?: string;
}

/** Who performed an audited operation. */
export interface AuditActor {
  userId?: string;
  email?: string;
  ipAddress?: string;
}

/** An audit entry as the dashboard API returns it. */
export interface AuditLogView {
  _id: Types.ObjectId;
  action: string;
  module: string;
  userId?: Types.ObjectId | string;
  userEmail: string;
  ipAddress: string;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The actor of a request, for {@link AuditService.record}. */
export const auditActorOf = (
  user: { user_id?: string; email?: string } | undefined,
  ipAddress?: string,
): AuditActor => ({ userId: user?.user_id, email: user?.email, ipAddress });

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async log(dto: CreateAuditLogDto, session?: any): Promise<AuditLogDocument> {
    const entry: CreateAuditLogDto = {
      ...dto,
      module: dto.module.toLowerCase(),
      previousData: redactSensitive(dto.previousData),
      newData: redactSensitive(dto.newData),
    };
    const [log] = await this.auditLogModel.create(
      [entry],
      session ? { session } : {},
    );
    return log;
  }

  /**
   * Writes an entry for an operation performed by `actor`. Never throws: the
   * operation already happened, a failed audit write is only logged.
   */
  async record(
    action: string,
    module: string,
    actor: AuditActor,
    data: { previousData?: object; newData?: object } = {},
  ): Promise<void> {
    await this.log({
      action,
      module,
      userId: actor.userId,
      userEmail: actor.email ?? '',
      ipAddress: actor.ipAddress ?? '',
      previousData: data.previousData as Record<string, unknown> | undefined,
      newData: data.newData as Record<string, unknown> | undefined,
    }).catch((err: unknown) =>
      this.logger.warn(
        `Audit log failed (${module}/${action}): ${(err as Error)?.message}`,
      ),
    );
  }

  // ─── dashboard (read-only) ─────────────────────────────────────────────────

  /**
   * Newest-first page of entries matching the filters. The before/after data
   * is left out: it is only returned by {@link findOne}, which needs the
   * separate `view_audit_log_details` permission.
   */
  async findAll(query: AuditLogQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? AUDIT_DEFAULT_PAGE_LIMIT;
    const skip = (page - 1) * limit;
    const filter = this.buildFilter(query);

    const [total, data] = await Promise.all([
      this.auditLogModel.countDocuments(filter),
      this.auditLogModel
        .find(filter)
        .select('-previousData -newData')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean<AuditLogView[]>(),
    ]);

    return {
      results: data.length,
      pagination: {
        currentPage: page,
        limit,
        numberOfPages: Math.ceil(total / limit),
        totalResults: total,
        ...(skip + limit < total && { nextPage: page + 1 }),
        ...(page > 1 && { prevPage: page - 1 }),
      },
      data,
    };
  }

  /** One entry with its (redacted) before/after data. */
  async findOne(id: string): Promise<AuditLogView> {
    const entry = Types.ObjectId.isValid(id)
      ? await this.auditLogModel.findById(id).lean<AuditLogView>()
      : null;
    if (!entry) throw new NotFoundException('Audit log entry not found');
    return {
      ...entry,
      previousData: redactSensitive(entry.previousData),
      newData: redactSensitive(entry.newData),
    };
  }

  /** Distinct modules and actions, for the dashboard filter dropdowns. */
  async getFilterOptions() {
    const [modules, actions] = await Promise.all([
      this.auditLogModel.distinct('module'),
      this.auditLogModel.distinct('action'),
    ]);
    return {
      modules: modules.sort(),
      actions: actions.sort(),
    };
  }

  private buildFilter(query: AuditLogQueryDto): QueryFilter<AuditLogDocument> {
    // Loose while building: userId is stored as an ObjectId.
    const filter: QueryFilter<any> = {};
    if (query.module) filter.module = query.module.toLowerCase();
    if (query.action) filter.action = query.action;
    if (query.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query.userEmail) {
      filter.userEmail = {
        $regex: `^${escapeRegex(query.userEmail)}`,
        $options: 'i',
      };
    }
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from && { $gte: new Date(query.from) }),
        ...(query.to && { $lte: new Date(query.to) }),
      };
    }
    return filter;
  }
}
