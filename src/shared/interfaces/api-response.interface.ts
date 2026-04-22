export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  totalCount?: number;
  message?: string;
  data?: T;
  meta?: {
    total?: number;
    pagination?: any;
    [key: string]: any;
  };
  errors?: any;
  access_token?: string;
  timestamp: string;
  path: string;
}
