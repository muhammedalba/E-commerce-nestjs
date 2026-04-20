export interface QueryString {
  page?: string;
  limit?: string;
  sort?: string;
  fields?: string;
  keywords?: string;
  With_all_languages?: boolean;
  [key: string]: any;
}
