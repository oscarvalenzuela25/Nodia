import { create } from "zustand";
import { z } from "zod";

const referenceSchema = z.object({ groupKey: z.string().trim().min(1).max(128), moduleKey: z.string().trim().min(1).max(128) }).strict();
const slotSchema = referenceSchema.nullable();
export const mobilePreferencesSchema = z.object({
  version: z.literal(1), locked: z.boolean(), slots: z.tuple([slotSchema, slotSchema, slotSchema, slotSchema]),
}).strict().superRefine((value, context) => {
  const keys = value.slots.filter(slot => slot !== null).map(shortcutIdentity);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", message: "Duplicate shortcuts" });
});
export type ShortcutReference = z.infer<typeof referenceSchema>;
export type MobilePreferences = z.infer<typeof mobilePreferencesSchema>;
export const shortcutIdentity = (reference: ShortcutReference) => JSON.stringify([reference.groupKey, reference.moduleKey]);
export const createMobilePreferences = (): MobilePreferences => ({ version: 1, locked: false, slots: [null, null, null, null] });
export const mobileStorageKey = (ownerId: string) => `nodia:mobile-navigation:v1:${encodeURIComponent(ownerId)}`;
type State = {
  ownerId: string | null;
  preferences: MobilePreferences;
  readError: boolean;
  hydrate: (ownerId: string | null) => void;
  write: (ownerId: string, preferences: MobilePreferences) => void;
};

export const useMobileNavigationStore = create<State>((set, get) => ({
  ownerId: null, preferences: createMobilePreferences(), readError: false,
  hydrate: ownerId => {
    if (!ownerId) { set({ ownerId: null, preferences: createMobilePreferences(), readError: false }); return; }
    try {
      const raw = localStorage.getItem(mobileStorageKey(ownerId));
      if (raw && raw.length > 4096) throw new Error("Oversized preferences");
      const preferences = raw === null ? createMobilePreferences() : mobilePreferencesSchema.parse(JSON.parse(raw));
      set({ ownerId, preferences, readError: false });
    } catch {
      set({ ownerId, preferences: get().ownerId === ownerId ? get().preferences : createMobilePreferences(), readError: true });
    }
  },
  write: (ownerId, preferences) => {
    if (get().ownerId !== ownerId) throw new Error("Preference owner changed");
    const validated = mobilePreferencesSchema.parse(preferences);
    // Publish only after persistence succeeds, so a blocked browser does not report a saved preference.
    localStorage.setItem(mobileStorageKey(ownerId), JSON.stringify(validated));
    set({ preferences: validated, readError: false });
  },
}));
