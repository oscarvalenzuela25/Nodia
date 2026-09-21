export interface ExtractedInvoiceItem {
  code?: string | null;
  name: string;
  quantity: number;
  cost_price?: number | null;
  cost_price_tax?: number | null;
  unit_price?: number | null;
  total_price?: number | null;
  [key: string]: any;
}

export interface ExtractedInvoiceData {
  code: string;
  total_amount: number;
  issue_date?: string;
  items: ExtractedInvoiceItem[];
  raw_data?: Record<string, any>;
}

export type AiProvider = 'gemini' | 'mistral';
