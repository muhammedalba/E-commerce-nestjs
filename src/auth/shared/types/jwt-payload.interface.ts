export interface JwtPayload {
  user_id: string;
  email: string;
  role: string;
  roleId?: string;
  level: number;
  iat?: number;
  exp?: number;
  /** Session (device) id, shared by every token pair issued for one login. */
  sid?: string;
  name?: string;
  password?: string;
  permissions?: string[];
}
