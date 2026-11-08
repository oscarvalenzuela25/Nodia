import { ModuleGroup } from '../entities/module-group.entity.js';
import type { OrderMetadata } from '../../module-order/order-metadata.js';

export type PaginationMeta = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type GetModuleGroupsResponse = {
  data: Array<ModuleGroup & { ordering?: OrderMetadata }>;
  meta: PaginationMeta;
};
