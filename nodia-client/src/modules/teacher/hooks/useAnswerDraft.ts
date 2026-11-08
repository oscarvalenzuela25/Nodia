import { useCallback, useEffect, useRef, useState } from "react";
import { sameAnswer } from "../infrastructure/presentation";
import { answerSchema, type Answer } from "../infrastructure/schemas";

export const TEACHER_ANSWER_IDLE_MS = 1500;
type Input = {
  answer: Answer | null;
  revision: number;
  busy: boolean;
  editable: boolean;
  onDraft: (answer: Answer | null) => void;
  onSave: (answer: Answer, expectedRevision: number) => Promise<number | null>;
};
type Pending = { answer: Answer; revision: number };
type Draft = { answer: Answer | null; confirmed: Answer | null; revision: number; edit: number; conflict: boolean; pending: Pending | null };

function captureFocus() {
  const element = document.activeElement;
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return null;
  return { element, start: element.selectionStart, end: element.selectionEnd };
}
function restoreFocus(snapshot: ReturnType<typeof captureFocus>) {
  if (!snapshot) return;
  requestAnimationFrame(() => {
    if (!snapshot.element.isConnected || snapshot.element.disabled) return;
    if (document.activeElement !== document.body && document.activeElement !== snapshot.element) return;
    snapshot.element.focus({ preventScroll: true });
    if (snapshot.start !== null && snapshot.end !== null && ["text", "search", "textarea"].includes(snapshot.element.type)) snapshot.element.setSelectionRange(snapshot.start, snapshot.end);
  });
}

/** Autosave is a draft command only. A failed/uncertain version is never retried by a timer. */
export function useAnswerDraft(input: Input) {
  const [draft, setDraft] = useState<Draft>({ answer: input.answer, confirmed: input.answer, revision: input.revision, edit: 0, conflict: false, pending: null });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const flight = useRef(false);
  const attemptedEdit = useRef(-1);
  const mounted = useRef(true);
  const saveRef = useRef(input.onSave);
  const pendingFocus = useRef<ReturnType<typeof captureFocus>>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { saveRef.current = input.onSave; }, [input.onSave]);
  useEffect(() => {
    if (input.busy || saving || !input.editable || !pendingFocus.current) return;
    const focus = pendingFocus.current;
    pendingFocus.current = null;
    restoreFocus(focus);
  }, [input.busy, input.editable, saving]);

  if (input.revision > draft.revision) {
    const wasClean = sameAnswer(draft.answer, draft.confirmed);
    const ownAcknowledgement = draft.pending !== null && sameAnswer(input.answer, draft.pending.answer);
    setDraft({ ...draft, answer: wasClean ? input.answer : draft.answer, confirmed: input.answer, revision: input.revision, conflict: !wasClean && !sameAnswer(draft.answer, input.answer) && !ownAcknowledgement });
  }
  const dirty = !sameAnswer(draft.answer, draft.confirmed);
  const valid = draft.answer !== null && answerSchema.safeParse(draft.answer).success;
  const { onDraft } = input;
  useEffect(() => { onDraft(dirty ? draft.answer : null); }, [onDraft, dirty, draft.answer]);

  const change = (answer: Answer) => {
    setFailed(false);
    setDraft(current => ({ ...current, answer, edit: current.edit + 1 }));
  };
  const save = useCallback(async () => {
    if (flight.current || input.busy || !input.editable || !draft.answer || !dirty || !valid) return false;
    const answer = draft.answer;
    const expectedRevision = draft.revision;
    attemptedEdit.current = draft.edit;
    flight.current = true;
    pendingFocus.current = captureFocus();
    setSaving(true);
    setDraft(current => ({ ...current, pending: { answer, revision: expectedRevision } }));
    let responseRevision: number | null = null;
    try { responseRevision = await saveRef.current(answer, expectedRevision); }
    catch { /* The command owner handles HTTP feedback and receipt recovery. */ }
    finally {
      flight.current = false;
      if (mounted.current) {
        const confirmed = responseRevision !== null && responseRevision > expectedRevision;
        setFailed(!confirmed);
        setDraft(current => confirmed && responseRevision! >= current.revision ? { ...current, confirmed: answer, revision: responseRevision!, pending: null, conflict: false } : { ...current, pending: null });
        setSaving(false);
      }
    }
    return responseRevision !== null && responseRevision > expectedRevision;
  }, [input.busy, input.editable, draft.answer, draft.revision, draft.edit, dirty, valid]);

  useEffect(() => {
    if (!dirty || !valid || !draft.answer || input.busy || !input.editable || saving || draft.conflict || failed || attemptedEdit.current === draft.edit) return;
    const timer = window.setTimeout(() => { void save(); }, TEACHER_ANSWER_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, valid, draft.answer, draft.edit, draft.conflict, input.busy, input.editable, saving, failed, save]);

  return { answer: draft.answer, confirmedAnswer: draft.confirmed, revision: draft.revision, dirty, valid, conflict: draft.conflict, saving, change, save, status: saving ? "saving" as const : draft.conflict ? "conflict" as const : failed && dirty ? "save_failed" as const : dirty ? "unsaved" as const : "saved" as const };
}
