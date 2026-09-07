import { Role } from '../entities/role.entity.js';

export type PaginationMeta = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type GetRolesResponse = {
  data: Role[];
  meta: PaginationMeta;
};
