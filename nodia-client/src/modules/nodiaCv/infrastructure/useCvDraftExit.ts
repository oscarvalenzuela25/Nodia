import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router";

type DraftExitOptions = {
  unsaved: boolean;
  save: () => Promise<boolean>;
  retire: (saved: boolean) => void;
};

export function useCvDraftExit({ unsaved, save, retire }: DraftExitOptions) {
  const [continueAction, setContinueAction] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const savingLock = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    unsaved && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const request = (action: () => void) => {
    if (savingLock.current || continueAction || blocker.state === "blocked") return;
    if (!unsaved) {
      action();
      return;
    }
    setSaveFailed(false);
    setContinueAction(() => action);
  };

  const keepEditing = () => {
    if (savingLock.current) return;
    if (blocker.state === "blocked") blocker.reset();
    setContinueAction(null);
    setSaveFailed(false);
  };

  const finish = (saved: boolean) => {
    retire(saved || !unsaved);
    setContinueAction(null);
    setSaveFailed(false);
    if (blocker.state === "blocked") blocker.proceed();
    else continueAction?.();
  };

  const saveAndLeave = async () => {
    if (savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      if (await save()) finish(true);
      else setSaveFailed(true);
    } catch {
      setSaveFailed(true);
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  };

  return {
    open: Boolean(continueAction) || blocker.state === "blocked",
    request,
    saving,
    saveFailed,
    keepEditing,
    saveAndLeave,
    discard: () => {
      if (!savingLock.current) finish(false);
    },
  };
}
