export interface JwtPayload {
  user_id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}
