import { Product } from '../entities/product.entity.js';
import { ProductLog } from '../entities/product-log.entity.js';

export type PaginationMeta = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type GetProductsResponse = {
  data: Product[];
  meta: PaginationMeta;
};

export type GetProductLogsResponse = {
  data: ProductLog[];
  meta: PaginationMeta;
};
