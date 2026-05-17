import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { RolesService } from '../services/roles.service';
import { CreateRoleDto, UpdateRoleDto } from '../shared/dto/role.dto';
import { Permissions } from '../shared/enums/permissions.enum';
import { RequirePermission } from '../shared/decorators/require-permission.decorator';
import { AuthGuard } from '../../auth/shared/guards/auth.guard';
import { PermissionsGuard } from '../shared/guards/permissions.guard';
import { JwtPayload } from '../../auth/shared/types/jwt-payload.interface';

interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user: JwtPayload;
}

@Controller('roles')
@UseGuards(AuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // ─── Create Role ──────────────────────────────────────────────────────────
  @Post()
  @RequirePermission(Permissions.MANAGE_ROLES)
  async createRole(
    @Body() createRoleDto: CreateRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const role = await this.rolesService.createRole(createRoleDto, req.user);
    return { success: true, data: role };
  }

  // ─── Update Role ──────────────────────────────────────────────────────────
  @Put(':id')
  @RequirePermission(Permissions.MANAGE_ROLES)
  async updateRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return await this.rolesService.updateRole(id, updateRoleDto, req.user);
  }

  // ─── Delete Role ──────────────────────────────────────────────────────────
  @Delete(':id')
  @RequirePermission(Permissions.MANAGE_ROLES)
  async deleteRole(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return await this.rolesService.deleteRole(id, req.user);
  }

  // ─── Get All Roles ────────────────────────────────────────────────────────
  @Get()
  @RequirePermission(Permissions.VIEW_ROLES)
  async getAllRoles(): Promise<any> {
    return await this.rolesService.getAllRoles();
  }

  // ─── Get Permissions Grouped by Category (for UI Checkbox Grid) ───────────
  @Get('permissions-list')
  @RequirePermission(Permissions.MANAGE_ROLES)
  getAllPermissions(): any {
    return this.rolesService.getGroupedPermissions();
  }

  // ─── Get Current User's Own Permissions ───────────────────────────────────
  @Get('my-permissions')
  async getMyPermissions(@Req() req: AuthenticatedRequest) {
    const isSuperAdmin = req.user.level === 100;
    const permissions = isSuperAdmin
      ? Object.values(Permissions) // SuperAdmin gets all permissions
      : await this.rolesService.getUserPermissions(req.user.user_id);

    return {
      success: true,
      isSuperAdmin,
      level: req.user.level,
      role: req.user.role,
      permissions,
    };
  }
}
