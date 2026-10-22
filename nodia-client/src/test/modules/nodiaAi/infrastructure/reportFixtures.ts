import type { NodiaAiReport } from "../../../../modules/nodiaAi/infrastructure/reportSchemas";
import { chatId, runId } from "./fixtures";

/** Synthetic report only; no real account, provider, quota or business data. */
export const report: NodiaAiReport = {
  status: "partial", report_id: chatId, catalog_version: "synthetic-report-catalog",
  combine: "separate", snapshot_consistency: "independent_source_snapshots",
  columns: [{ key: "owner.total", label_key: "synthetic.total", value_type: "decimal", unit: "peso", scale: 0, source_aliases: ["owner"] }],
  rows: [["90071992547409930"]],
  provenance: [{ source_alias: "owner", source_key: "finance_movements", observed_at: "2026-10-17T12:01:00Z", scope: { subject_user_id: "9" }, measure_keys: ["confirmed_amount"], period: null, basis_key: "created_at", matched_records: "2" }],
  source_results: [{
    status: "ok", report_id: runId, catalog_version: "synthetic-report-catalog", source_key: "finance_movements", source_alias: "owner", scope: { subject_user_id: "9" },
    columns: [
      { key: "category", label_key: "synthetic.category", value_type: "text", unit: null, scale: null, source_aliases: ["owner"] },
      { key: "total", label_key: "synthetic.total", value_type: "decimal", unit: "peso", scale: 0, source_aliases: ["owner"] },
    ], rows: [[null, "0"], ["Food", "90071992547409930"]], totals: { total: "90071992547409930" }, matched_records: "2", period: null, basis_key: "created_at", observed_at: "2026-10-17T12:01:00Z", group_page_complete: false, next_cursor: "synthetic-source-cursor",
  }],
  source_errors: [{ source_alias: "unavailable", error: { code: "report_unavailable", message_key: "nodia_ai:report_unavailable", field_errors: [], retry_action: "none", correlation_id: chatId } }],
  group_page_complete: false, next_cursor: "synthetic-multi-cursor", clarification_keys: [],
};
