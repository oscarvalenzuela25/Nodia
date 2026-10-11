type DialogModule = typeof import("../MobileShortcutDialog");
let pending: Promise<DialogModule> | undefined;

// Share the successful import; a network failure must allow another attempt.
export const loadShortcutDialog = () => {
  pending ??= import("../MobileShortcutDialog").catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
};
