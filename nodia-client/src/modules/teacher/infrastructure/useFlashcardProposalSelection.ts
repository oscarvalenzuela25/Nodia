import type { z } from "zod";
import { flashcardLibraryPath, type FlashcardProposalPart } from "./flashcardLibraryProposal";
import { type connectionsSchema, eligibilitySchema, type Selection } from "./schemas";
import { sameSelection } from "./selection";
import { useTeacherQuery } from "./useServices";

type Catalog = { data?: z.infer<typeof connectionsSchema>; isFetching: boolean; isError: boolean };
const proposalEligibilitySchema = eligibilitySchema.omit({ checked_at: true });

export function useFlashcardProposalSelection(kind: FlashcardProposalPart, choice: Selection | null, catalog: Catalog, enabled: boolean) {
  const options = (catalog.data?.items ?? []).flatMap(connection => {
    const api = connection.modes.find(mode => mode.mode === "api_key" && mode.configuration === "configured");
    return connection.is_active && api?.models.length
      ? [{ id: connection.connection_id, label: connection.label, models: api.models }]
      : [];
  });
  const connection = options.find(option => option.id === choice?.connection_id);
  const model = connection?.models.find(option => option.model_id === choice?.model_id);
  const selection = choice && model && (choice.effort_id === null || model.efforts.some(effort => effort.effort_id === choice.effort_id))
    ? choice : null;
  const eligibility = useTeacherQuery(
    flashcardLibraryPath + "/eligibility", proposalEligibilitySchema,
    selection ? { kind, mode: selection.mode, connection_id: selection.connection_id, model_id: selection.model_id,
      ...(selection.effort_id !== null && { effort_id: selection.effort_id }) } : undefined,
    Boolean(enabled && selection && !catalog.isFetching && !catalog.isError),
  );
  const result = sameSelection(eligibility.data?.selection, selection) ? eligibility.data : undefined;
  const ready = Boolean(selection && result?.eligible && !catalog.isFetching && !catalog.isError && !eligibility.isFetching && !eligibility.isError);
  return { options, connection, model, selection, eligibility, result, ready };
}
