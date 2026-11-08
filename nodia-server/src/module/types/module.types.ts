import { Module } from '../entities/module.entity.js';
import type { OrderMetadata } from '../../module-order/order-metadata.js';

export type PaginationMeta = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type GetModulesResponse = {
  data: Array<Module & { ordering?: OrderMetadata; group_ordering?: OrderMetadata }>;
  meta: PaginationMeta;
};
