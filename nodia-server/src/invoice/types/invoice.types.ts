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
  total_amount: number | null;
  path_storage?: string | null;
  data: {
    issue_date?: string;
    items: ExtractedInvoiceItem[];
    [key: string]: any;
  };
}

export interface VerifyIaProviderItem {
  id: string;
  key: string;
  name: string;
  mode: string;
  use_api_key?: boolean;
  use_token_plan_web?: boolean;
  use_token_plan_agentic?: boolean;
  default_mode?: string | null;
  active_mode?: 'api_key' | 'token_plan_web' | 'token_plan_agentic' | null;
  is_default?: boolean;
  is_active: boolean;
  can_use_model: boolean;
  error?: string | null;
  fields?: {
    selected_model?: string | null;
    ocr_model?: string | null;
    ocr_focus_model?: string | null;
    enable_extended_thinking?: boolean;
    available_models?: any[];
    [key: string]: any;
  };
  default_model?: string | null;
  ocr_model?: string | null;
  supports_thinking?: boolean;
  extended_thinking_enabled?: boolean;
}

export type VerifyIaProvidersResponse = VerifyIaProviderItem[];
