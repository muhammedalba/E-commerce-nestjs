import { Logger } from '@nestjs/common';
import { AuditService } from 'src/audit/audit.service';
import { sanitizeError } from './backup.types';

/** Who triggered a backup operation (for the audit log). */
export interface BackupActor {
  userId?: string;
  email?: string;
  ipAddress?: string;
}

/**
 * Writes a `backup` audit entry. Never throws: a failed audit write is
 * logged, the operation itself already happened.
 */
export async function auditBackup(
  audit: AuditService,
  logger: Logger,
  action: string,
  actor: BackupActor,
  data: { previousData?: object; newData?: object },
): Promise<void> {
  await audit
    .log({
      action,
      module: 'backup',
      userId: actor.userId,
      userEmail: actor.email,
      ipAddress: actor.ipAddress,
      previousData: data.previousData as Record<string, unknown> | undefined,
      newData: data.newData as Record<string, unknown> | undefined,
    })
    .catch((err: unknown) =>
      logger.warn(`Audit log failed: ${sanitizeError(err)}`),
    );
}
