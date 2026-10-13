import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './shared/dto/audit-log-query.dto';

/**
 * Read-only audit log for the dashboard. Entries are never edited or
 * deleted through the API; they expire through the schema's TTL index.
 *
 * | Method | Route | Permission |
 * |--------|-------|------------|
 * | GET | `/audit-logs` | view_audit_logs |
 * | GET | `/audit-logs/filters` | view_audit_logs |
 * | GET | `/audit-logs/:id` | view_audit_log_details |
 */
@Controller('audit-logs')
@UseGuards(AuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission(Permissions.VIEW_AUDIT_LOGS)
  findAll(@Query() query: AuditLogQueryDto) {
    return this.audit.findAll(query);
  }

  @Get('filters')
  @RequirePermission(Permissions.VIEW_AUDIT_LOGS)
  getFilterOptions() {
    return this.audit.getFilterOptions();
  }

  @Get(':id')
  @RequirePermission(Permissions.VIEW_AUDIT_LOG_DETAILS)
  findOne(@Param('id') id: string) {
    return this.audit.findOne(id);
  }
}
