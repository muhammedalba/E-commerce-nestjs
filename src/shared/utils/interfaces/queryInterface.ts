export interface QueryString {
  page?: string;
  limit?: string;
  sort?: string;
  fields?: string;
  keywords?: string;
  With_all_languages?: boolean;
  [key: string]: any;
}
export interface PaginationResult {
  currentPage?: number;
  limit?: number;
  numberOfPages?: number;
  totalResults?: number;
  nextPage?: number;
  prevPage?: number;
  [key: string]: unknown;
}
