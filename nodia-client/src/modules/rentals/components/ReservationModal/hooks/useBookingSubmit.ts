import { useRef } from "react";
export function useBookingSubmit<T, R>(
  save: (value: T) => Promise<R | undefined>,
  done: (result: R) => void,
) {
  const active = useRef(false);
  return async (value: T) => {
    if (active.current) return;
    active.current = true;
    try {
      const result = await save(value);
      if (result !== undefined) done(result);
    } catch {
      /* Shared mutation/preview infrastructure owns HTTP feedback. */
    } finally {
      active.current = false;
    }
  };
}
