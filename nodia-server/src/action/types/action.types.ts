import { Action } from '../entities/action.entity.js';

export type PaginationMeta = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type GetActionsResponse = {
  data: Action[];
  meta: PaginationMeta;
};
