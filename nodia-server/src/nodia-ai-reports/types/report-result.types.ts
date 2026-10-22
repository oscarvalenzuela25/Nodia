import type { ReportScalar, ReportPeriod } from './report-query.types.js';

/** Single-source engine output. Cross-source presentation/wire assembly belongs to AI-31. */
export interface NodiaAiSourceReportResult {
  status: 'ok' | 'empty';
  report_id: string;
  catalog_version: string;
  source_key: string;
  source_alias: string;
  scope: {
    subject_user_id?: string;
    business_id?: string;
    property_id?: string;
    provider_id?: string;
  };
  columns: {
    key: string;
    label_key: string;
    value_type: 'text' | 'decimal' | 'number' | 'boolean' | 'date' | 'instant';
    unit: string | null;
    scale: number | null;
    source_aliases: string[];
  }[];
  rows: ReportScalar[][];
  totals: Record<string, string>;
  matched_records: string;
  period: ReportPeriod | null;
  basis_key: string;
  observed_at: string;
  group_page_complete: boolean;
  next_cursor: string | null;
}
