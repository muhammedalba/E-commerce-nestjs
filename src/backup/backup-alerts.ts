import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import { Role, RoleDocument } from 'src/roles/shared/schemas/role.schema';
import { BACKUP_PERMISSIONS } from 'src/roles/shared/enums/permissions.enum';
import { BackupConfig } from './backup.config';
import { sanitizeError } from './backup.types';

/**
 * - failed: a backup job failed after its last attempt;
 * - unverified: a backup was created but failed its automatic verification;
 * - stale: no successful backup for longer than the schedule allows.
 */
export type BackupAlertKind = 'failed' | 'unverified' | 'stale';

export interface BackupAlert {
  kind: BackupAlertKind;
  /** Already sanitized. */
  reason: string;
  jobId?: string;
  trigger?: string;
  attemptsMade?: number;
}

const SUBJECTS: Record<BackupAlertKind, string> = {
  failed: 'تنبيه: فشل النسخ الاحتياطي لقاعدة البيانات / Database Backup Failed',
  unverified:
    'تنبيه: نسخة احتياطية فشلت في الفحص / Database Backup Failed Verification',
  stale: 'تنبيه: لا توجد نسخة احتياطية حديثة / No Recent Database Backup',
};

const ACTIONS: Record<BackupAlertKind, string> = {
  failed: 'DATABASE_BACKUP_FAILED',
  unverified: 'DATABASE_BACKUP_UNVERIFIED',
  stale: 'DATABASE_BACKUP_STALE',
};

function inAppMessage(alert: BackupAlert): { ar: string; en: string } {
  switch (alert.kind) {
    case 'unverified':
      return {
        ar: 'أُنشئت نسخة احتياطية لكنها فشلت في الفحص. راجع صفحة النسخ الاحتياطي.',
        en: 'A backup was created but failed verification. Check the Backups page.',
      };
    case 'stale':
      return {
        ar: 'لم تُنشأ نسخة احتياطية ناجحة منذ مدة أطول من المتوقع. راجع صفحة النسخ الاحتياطي وسجلات الخادم.',
        en: 'No successful backup for longer than expected. Check the Backups page and the server logs.',
      };
    default:
      return {
        ar: `فشل النسخ الاحتياطي لقاعدة البيانات بعد ${alert.attemptsMade ?? 0} محاولات. راجع سجلات الخادم.`,
        en: `Database backup failed after ${alert.attemptsMade ?? 0} attempts. Check the server logs.`,
      };
  }
}

/**
 * Backup alerts: an email to BACKUP_ALERT_EMAIL (else ADMIN_EMAIL) and an
 * in-app notification to every role holding a backup permission, both via
 * the existing mail queue.
 */
@Injectable()
export class BackupAlerts {
  private readonly logger = new Logger(BackupAlerts.name);

  constructor(
    private readonly config: BackupConfig,
    @InjectQueue('mail-queue') private readonly mailQueue: Queue,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  /** Queues the alert. Never throws. */
  async send(alert: BackupAlert): Promise<void> {
    const at = new Date().toISOString();
    try {
      const roles = await this.roleModel
        .find({ permissions: { $in: BACKUP_PERMISSIONS } })
        .select('_id')
        .lean();
      const email = this.config.alertEmail;
      await Promise.all([
        ...(email
          ? [
              this.mailQueue.add('backup-failed', {
                email,
                jobId: alert.jobId ?? 'N/A',
                trigger: alert.trigger ?? 'N/A',
                attemptsMade: alert.attemptsMade ?? 0,
                failedAt: at,
                reason: alert.reason,
                subject: SUBJECTS[alert.kind],
                lang: this.config.defaultLanguage,
              }),
            ]
          : []),
        ...roles.map((role) =>
          this.mailQueue.add('admin-role-notification', {
            roleId: role._id.toString(),
            action: ACTIONS[alert.kind],
            message: inAppMessage(alert),
            payload: { jobId: alert.jobId, failedAt: at, reason: alert.reason },
          }),
        ),
      ]);
    } catch (err) {
      // The problem itself is already logged and recorded by the caller.
      this.logger.error(
        `Could not queue the backup ${alert.kind} alert: ${sanitizeError(err)}`,
      );
    }
  }
}
