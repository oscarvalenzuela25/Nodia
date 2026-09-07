import { User } from '../entities/user.entity.js';

export type PaginationMeta = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type GetUsersResponse = {
  data: User[];
  meta: PaginationMeta;
};
