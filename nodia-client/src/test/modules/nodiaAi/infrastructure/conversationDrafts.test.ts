import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConversationDrafts } from "../../../../modules/nodiaAi/infrastructure/conversationDrafts";

const owner = { actorId: "synthetic-owner", conversationId: "synthetic-chat" };
const expiry = "2030-01-01T00:00:00Z";
beforeEach(() => window.sessionStorage.clear());
describe("tab-local unsent conversation text", () => {
  it("restores after a new store is created, isolated by actor and conversation", () => {
    const localBefore = { ...window.localStorage };
    const first = createConversationDrafts(() => window.sessionStorage, 100, () => 1);
    first.set(owner, "Unsent synthetic text", expiry);
    const reloaded = createConversationDrafts(() => window.sessionStorage, 100, () => 1);
    expect(reloaded.get(owner)).toBe("Unsent synthetic text");
    expect(reloaded.get({ ...owner, actorId: "other" })).toBe("");
    expect(reloaded.get({ ...owner, conversationId: "other" })).toBe("");
    expect({ ...window.localStorage }).toEqual(localBefore);
  });
  it("expires at the backend deadline and does not renew it on reads", () => {
    let now = 1;
    const store = createConversationDrafts(() => window.sessionStorage, 100, () => now);
    store.set(owner, "Synthetic text", expiry);
    now = Date.parse(expiry) - 1;
    expect(store.get(owner)).toBe("Synthetic text");
    now++;
    expect(store.get(owner)).toBe("");
    expect(window.sessionStorage.length).toBe(0);
  });
  it.each(["not-a-date", "1970-01-01T00:00:00Z"])("rejects invalid/expired deadlines: %s", value => {
    const store = createConversationDrafts(() => window.sessionStorage, 100, () => 1);
    store.set(owner, "Synthetic text", value);
    expect(store.get(owner)).toBe("");
    expect(window.sessionStorage.length).toBe(0);
  });
  it("ignores and removes malformed historical storage", () => {
    const store = createConversationDrafts(() => window.sessionStorage, 100, () => 1);
    store.set(owner, "Synthetic text", expiry);
    const key = window.sessionStorage.key(0)!;
    window.sessionStorage.setItem(key, '{"text":{"secret":"invalid"},"expiresAt":9999999999999}');
    expect(createConversationDrafts(() => window.sessionStorage, 100).get(owner)).toBe("");
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });
  it("keeps editing possible with denied or exhausted browser storage", () => {
    const store = createConversationDrafts(() => { throw new Error("Synthetic storage denied"); }, 100, () => 1);
    expect(() => store.set(owner, "Synthetic text", expiry)).not.toThrow();
    expect(store.get(owner)).toBe("Synthetic text");
    store.clear();
    expect(store.get(owner)).toBe("");
  });
  it("removes the previous persisted revision when updating exceeds the browser quota", () => {
    const store = createConversationDrafts(() => window.sessionStorage, 100, () => 1);
    store.set(owner, "Old synthetic draft", expiry);
    const failure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Synthetic quota exceeded"); });
    try {
      store.set(owner, "Current synthetic edit", expiry);
      expect(store.get(owner)).toBe("Current synthetic edit");
      expect(window.sessionStorage.length).toBe(0);
      expect(createConversationDrafts(() => window.sessionStorage, 100, () => 1).get(owner)).toBe("");
    } finally { failure.mockRestore(); }
  });
  it("measures the UTF-8 boundary, keeping excess editing in memory but never restoring it", () => {
    const store = createConversationDrafts(() => window.sessionStorage, 4, () => 1);
    store.set(owner, "😀", expiry);
    expect(createConversationDrafts(() => window.sessionStorage, 4, () => 1).get(owner)).toBe("😀");
    store.set(owner, "😀a", expiry);
    expect(store.get(owner)).toBe("😀a");
    expect(window.sessionStorage.length).toBe(0);
    expect(createConversationDrafts(() => window.sessionStorage, 4, () => 1).get(owner)).toBe("");
    store.set(owner, "back", expiry);
    expect(createConversationDrafts(() => window.sessionStorage, 4, () => 1).get(owner)).toBe("back");
  });
  it("discards over-limit or open-shaped persisted payloads", () => {
    const store = createConversationDrafts(() => window.sessionStorage, 4, () => 1);
    store.set(owner, "text", expiry);
    const key = window.sessionStorage.key(0)!;
    for (const raw of [JSON.stringify({ text: "x".repeat(10000), expiresAt: Date.parse(expiry) }),
      JSON.stringify({ text: "text", expiresAt: Date.parse(expiry), attachment: "not-allowed" })]) {
      window.sessionStorage.setItem(key, raw);
      expect(createConversationDrafts(() => window.sessionStorage, 4, () => 1).get(owner)).toBe("");
      expect(window.sessionStorage.getItem(key)).toBeNull();
    }
  });
  it("prunes expired drafts for chats other than the currently open one", () => {
    let now = 1;
    const store = createConversationDrafts(() => window.sessionStorage, 100, () => now);
    store.set(owner, "Synthetic text", expiry);
    store.set({ ...owner, conversationId: "other" }, "Other", "2031-01-01T00:00:00Z");
    now = Date.parse(expiry);
    store.prune();
    expect(window.sessionStorage.length).toBe(1);
    expect(store.get(owner)).toBe("");
    expect(store.get({ ...owner, conversationId: "other" })).toBe("Other");
  });
  it("does not restore a stored deadline beyond the currently authorized backend deadline", () => {
    const store = createConversationDrafts(() => window.sessionStorage, 100, () => 1);
    store.set(owner, "Synthetic draft", expiry);
    expect(store.get(owner, "2029-01-01T00:00:00Z")).toBe("");
    expect(window.sessionStorage.length).toBe(0);
  });
  it("clears its namespace without touching other browser state and notifies readers", () => {
    const store = createConversationDrafts(() => window.sessionStorage, 100, () => 1);
    const listener = vi.fn(), unsubscribe = store.subscribe(listener);
    window.sessionStorage.setItem("unrelated", "keep");
    store.set(owner, "Synthetic text", expiry);
    store.clear();
    expect(store.get(owner)).toBe("");
    expect(window.sessionStorage.getItem("unrelated")).toBe("keep");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
