import { SetMetadata } from '@nestjs/common';
import { roles } from '../enums/role.enum';

export const Roles_key = 'roles';
export const Roles = (...roles: [roles, ...roles[]]) =>
  SetMetadata(Roles_key, roles);
