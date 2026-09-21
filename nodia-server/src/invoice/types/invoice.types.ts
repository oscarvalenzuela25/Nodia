import { Invoice } from '../entities/invoice.entity.js';
import { ExtractedInvoiceItem } from '../../common/ai/gemini.service.js';

export type PaginationMeta = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type GetInvoicesResponse = {
  data: Invoice[];
  meta: PaginationMeta;
};

export interface AnalyzeInvoiceResponse {
  business_id: string;
  provider_id: string | null;
  code: string;
  total_amount: number;
  path_storage?: string | null;
  data: {
    issue_date?: string;
    items: ExtractedInvoiceItem[];
    [key: string]: any;
  };
}
