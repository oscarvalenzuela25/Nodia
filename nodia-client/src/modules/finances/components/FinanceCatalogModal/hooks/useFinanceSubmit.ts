import { useRef } from "react";

/** Guards the handler itself, including two submits before React disables the controls. */
export function useFinanceSubmit<T>(
  save: (payload: T) => Promise<unknown>,
  onClose: () => void,
  onSaved?: () => void,
) {
  const submitting = useRef(false);
  return async (payload: T) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await save(payload);
      try { onSaved?.(); }
      finally { onClose(); }
    } catch {
      // Infrastructure owns feedback; a rejection must preserve the entire draft.
    } finally {
      submitting.current = false;
    }
  };
}
