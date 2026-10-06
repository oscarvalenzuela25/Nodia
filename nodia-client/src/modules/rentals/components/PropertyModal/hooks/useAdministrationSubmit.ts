import { useRef } from "react";

/** Guard before React renders disabled controls; failures preserve the caller's draft. */
export function useAdministrationSubmit<T, R>(
  save: (data: T) => Promise<R | undefined>,
  onSuccess: (result: R) => void,
) {
  const submitting = useRef(false);
  return async (data: T) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const result = await save(data);
      if (result !== undefined) onSuccess(result);
    } catch {
      /* Shared mutation infrastructure owns HTTP feedback. */
    } finally {
      submitting.current = false;
    }
  };
}
