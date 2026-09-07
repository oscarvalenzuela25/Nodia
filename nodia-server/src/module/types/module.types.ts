import { Module } from '../entities/module.entity.js';

export type ModuleType = 'module' | 'submodule';

export interface ParentModuleSummary {
  id: string;
  key: string;
  type: ModuleType;
  is_active: boolean;
}

export type PaginationMeta = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type GetModulesResponse = {
  data: Module[];
  meta: PaginationMeta;
};
