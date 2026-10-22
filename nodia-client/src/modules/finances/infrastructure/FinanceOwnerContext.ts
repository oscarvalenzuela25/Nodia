import { createContext, useContext, useEffect } from "react";
export const FinanceOwnerContext = createContext<{
  ownerId?: string;
  lock?: () => () => void;
}>({});
export function useFinanceScopeLock(locked: boolean) {
  const { lock } = useContext(FinanceOwnerContext);
  useEffect(() => (locked ? lock?.() : undefined), [locked, lock]);
}
