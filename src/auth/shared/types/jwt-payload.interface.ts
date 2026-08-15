export interface JwtPayload {
  user_id: string;
  email: string;
  role: string;
  level: number;
  iat?: number;
  exp?: number;
  name?: string;
  password?: string;
  permissions?: string[];
}
