export interface CreateRoleDto {
  name: string;
  level: number;
  permissions?: string[];
  [key: string]: any;
}

export type UpdateRoleDto = Partial<CreateRoleDto>;
