import { ModuleGroup } from '../entities/module-group.entity.js';

export type PaginationMeta = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type GetModuleGroupsResponse = {
  data: ModuleGroup[];
  meta: PaginationMeta;
};
