export interface QueryString {
  page?: string;
  limit?: string;
  sort?: string;
  fields?: string;
  keywords?: string;
  [key: string]: any;
}
