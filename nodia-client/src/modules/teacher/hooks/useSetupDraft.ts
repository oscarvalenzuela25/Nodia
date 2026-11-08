import { useCallback, useEffect, useRef, useState } from "react";

export const SETUP_DRAFT_IDLE_MS = 1500;
export type SetupDraftReceipt = { setup_draft_text: string; setup_draft_revision: number };
type Input = { text: string; revision: number; busy: boolean; editable: boolean; onSave: (text: string, revision: number) => Promise<SetupDraftReceipt | null> };
type Draft = { text: string; confirmed: string; revision: number; edit: number; conflict: boolean; pending: string | null };

/** Server-owned draft, separate from sending a message. No prompts or payloads in browser storage. */
export function useSetupDraft(input: Input) {
  const [draft, setDraft] = useState<Draft>({ text: input.text, confirmed: input.text, revision: input.revision, edit: 0, conflict: false, pending: null });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const flight = useRef(false);
  const attempted = useRef(-1);
  const mounted = useRef(true);
  const saveRef = useRef(input.onSave);
  const focus = useRef<{ element: HTMLTextAreaElement; start: number; end: number } | null>(null);
  useEffect(() => { saveRef.current = input.onSave; }, [input.onSave]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  if (input.revision > draft.revision) {
    const clean = draft.text === draft.confirmed;
    const own = draft.pending === input.text;
    setDraft({ ...draft, text: clean ? input.text : draft.text, confirmed: input.text, revision: input.revision, conflict: !clean && draft.text !== input.text && !own });
  }
  const dirty = draft.text !== draft.confirmed;
  const valid = draft.text.length <= 4000 && new TextEncoder().encode(draft.text).length <= 8192;

  useEffect(() => {
    if (!dirty && !saving) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [dirty, saving]);
  useEffect(() => {
    if (input.busy || saving || !input.editable || !focus.current) return;
    const snapshot = focus.current; focus.current = null;
    requestAnimationFrame(() => {
      if (!snapshot.element.isConnected || snapshot.element.disabled || (document.activeElement !== document.body && document.activeElement !== snapshot.element)) return;
      snapshot.element.focus({ preventScroll: true }); snapshot.element.setSelectionRange(snapshot.start, snapshot.end);
    });
  }, [input.busy, input.editable, saving]);

  const change = (text: string) => { setFailed(false); setDraft(current => ({ ...current, text, edit: current.edit + 1 })); };
  const save = useCallback(async (): Promise<SetupDraftReceipt | null> => {
    if (flight.current || input.busy || !input.editable || !valid) return null;
    if (!dirty) return { setup_draft_text: draft.text, setup_draft_revision: draft.revision };
    flight.current = true; attempted.current = draft.edit;
    const element = document.activeElement;
    if (element instanceof HTMLTextAreaElement) focus.current = { element, start: element.selectionStart, end: element.selectionEnd };
    setSaving(true); setDraft(current => ({ ...current, pending: draft.text }));
    let receipt: SetupDraftReceipt | null = null;
    try { receipt = await saveRef.current(draft.text, draft.revision); }
    catch { /* The command owner reports errors and retains the original recovery intention. */ }
    finally {
      flight.current = false;
      if (mounted.current) {
        const confirmed = receipt !== null && receipt.setup_draft_revision >= draft.revision && receipt.setup_draft_text === draft.text;
        setFailed(!confirmed);
        setDraft(current => confirmed && receipt!.setup_draft_revision >= current.revision ? { ...current, confirmed: receipt!.setup_draft_text, revision: receipt!.setup_draft_revision, pending: null, conflict: false } : { ...current, pending: null });
        setSaving(false);
      }
    }
    return receipt && receipt.setup_draft_revision >= draft.revision && receipt.setup_draft_text === draft.text ? receipt : null;
  }, [input.busy, input.editable, valid, dirty, draft.text, draft.revision, draft.edit]);
  useEffect(() => {
    if (!dirty || !valid || input.busy || !input.editable || saving || failed || draft.conflict || attempted.current === draft.edit) return;
    const timer = window.setTimeout(() => { void save(); }, SETUP_DRAFT_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, valid, input.busy, input.editable, saving, failed, draft.conflict, draft.edit, save]);

  const sent = (text: string, receipt: SetupDraftReceipt | null) => {
    if (!receipt) return;
    setDraft(current => receipt.setup_draft_revision >= current.revision ? { ...current, text: current.text === text ? receipt.setup_draft_text : current.text, confirmed: receipt.setup_draft_text, revision: receipt.setup_draft_revision, pending: null, conflict: current.text !== text && current.text !== receipt.setup_draft_text } : current);
  };
  return { text: draft.text, revision: draft.revision, remoteText: draft.confirmed, dirty, valid, conflict: draft.conflict, saving, change, save, sent,
    pending: dirty ? { expected_draft_revision: draft.revision, text: draft.text } : undefined,
    status: saving ? "saving" as const : draft.conflict ? "conflict" as const : failed && dirty ? "failed" as const : dirty ? "unsaved" as const : "saved" as const };
}
