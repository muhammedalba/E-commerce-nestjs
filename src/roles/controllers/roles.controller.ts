import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { RolesService } from '../services/roles.service';
import { Permissions } from '../shared/enums/permissions.enum';
import { RequirePermission } from '../shared/decorators/require-permission.decorator';
import { AuthGuard } from '../../auth/shared/guards/auth.guard';
import { PermissionsGuard } from '../shared/guards/permissions.guard';

@Controller('roles')
@UseGuards(AuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // ─── Create Role ──────────────────────────────────────────────────────────
  @Post()
  @RequirePermission(Permissions.MANAGE_ROLES)
  async createRole(@Body() createRoleDto: any, @Req() req: any) {
    const role = await this.rolesService.createRole(createRoleDto, req.user);
    return { success: true, data: role };
  }

  // ─── Update Role ──────────────────────────────────────────────────────────
  @Put(':id')
  @RequirePermission(Permissions.MANAGE_ROLES)
  async updateRole(@Param('id') id: string, @Body() updateRoleDto: any, @Req() req: any) {
    const role = await this.rolesService.updateRole(id, updateRoleDto, req.user);
    return { success: true, data: role };
  }

  // ─── Delete Role ──────────────────────────────────────────────────────────
  @Delete(':id')
  @RequirePermission(Permissions.MANAGE_ROLES)
  async deleteRole(@Param('id') id: string, @Req() req: any) {
    const result = await this.rolesService.deleteRole(id, req.user);
    return { success: true, ...result };
  }

  // ─── Get All Roles ────────────────────────────────────────────────────────
  @Get()
  @RequirePermission(Permissions.VIEW_ROLES)
  async getAllRoles() {
    const roles = await this.rolesService.getAllRoles();
    return roles;
  }

  // ─── Get Permissions Grouped by Category (for UI Checkbox Grid) ───────────
  @Get('permissions-list')
  @RequirePermission(Permissions.MANAGE_ROLES)
  getAllPermissions() {
    return {
      success: true,
      data: this.rolesService.getGroupedPermissions(),
    };
  }

  // ─── Get Current User's Own Permissions ───────────────────────────────────
  @Get('my-permissions')
  async getMyPermissions(@Req() req: any) {
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

