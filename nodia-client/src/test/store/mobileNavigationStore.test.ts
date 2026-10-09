import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createMobilePreferences, mobileStorageKey, useMobileNavigationStore as store } from "../../store/mobileNavigationStore";

const reference = { groupKey: "tools", moduleKey: "reservations" };
beforeEach(() => store.getState().hydrate(null));
afterEach(() => vi.restoreAllMocks());
describe("local mobile preferences", () => {
  it("isolates identities and restores only references, without overwriting another person's choices", () => {
    store.getState().hydrate("a");
    store.getState().write("a", { ...createMobilePreferences(), locked: true, slots: [reference, null, null, null] });
    store.getState().hydrate("b");
    expect(store.getState().preferences).toEqual(createMobilePreferences());
    expect(() => store.getState().write("a", createMobilePreferences())).toThrow();
    store.getState().hydrate(null);
    store.getState().hydrate("a");
    expect(store.getState().preferences.slots[0]).toEqual(reference);
    expect(store.getState().preferences.locked).toBe(true);
    expect(JSON.parse(localStorage.getItem(mobileStorageKey("a"))!)).toEqual(store.getState().preferences);
  });
  it.each(["{", JSON.stringify({ version: 2, locked: false, slots: [null, null, null, null] }),
    JSON.stringify({ version: 1, locked: false, slots: [reference, reference, null, null] }),
    JSON.stringify({ version: 1, locked: false, slots: [null, null] }),
    JSON.stringify({ version: 1, locked: false, slots: [{ ...reference, path: "https://external.invalid" }, null, null, null] })])("rejects malformed preferences without crashing or rewriting storage: %s", raw => {
    localStorage.setItem(mobileStorageKey("a"), raw);
    store.getState().hydrate("a");
    expect(store.getState().readError).toBe(true);
    expect(store.getState().preferences).toEqual(createMobilePreferences());
    expect(localStorage.getItem(mobileStorageKey("a"))).toBe(raw);
  });
  it("keeps the last saved state when storage rejects a write or subsequent read", () => {
    store.getState().hydrate("a");
    const saved = { ...createMobilePreferences(), slots: [reference, null, null, null] as const };
    store.getState().write("a", { ...saved, slots: [...saved.slots] });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota", "QuotaExceededError"); });
    expect(() => store.getState().write("a", createMobilePreferences())).toThrow();
    expect(store.getState().preferences.slots[0]).toEqual(reference);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    store.getState().hydrate("a");
    expect(store.getState().preferences.slots[0]).toEqual(reference);
    store.getState().hydrate("b");
    expect(store.getState().preferences.slots[0]).toBeNull();
  });
});
