import { useState } from "react";
import { enrichmentSchema } from "../../infrastructure/enrichmentSchemas";
import { useTeacherQuery } from "../../infrastructure/useServices";
import type { AdaptivePanelProps } from "./types";

export function useEnrichment(props: AdaptivePanelProps) {
  const [page, setPage] = useState(1);
  const query = useTeacherQuery(`sessions/${props.session.id}/enrichment`, enrichmentSchema, { page }, props.visible);
  const disabled = props.busy || query.isFetching || ["paused", "archived"].includes(props.session.state);
  const readDisabled = props.busy || query.isFetching;
  const execute = async (operation: string, payload: Record<string, unknown>) => {
    if (disabled || !query.data) return null;
    const result = await props.command.execute(`sessions/${props.session.id}/enrichment/commands`, { expected_revision: query.data.revision, operation, payload });
    if (result) props.onResult(result);
    return result;
  };
  return { query, disabled, readDisabled, execute, page, setPage };
}
