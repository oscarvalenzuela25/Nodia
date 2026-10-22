import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPreferenceCatalog, getPreferenceOptions, getPreferences, preparePreference } from "../../../../modules/nodiaAi/infrastructure/preferenceServices";
import { catalog, createInput, preference, prepared } from "./preferenceFixtures";
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../../config/api", () => ({ mainInstance: http }));
describe("accepted preference HTTP boundaries", () => {
  beforeEach(() => vi.clearAllMocks());
  it("loads only authenticated catalog metadata and rejects invented permissions or unknown definitions", async () => {
    http.get.mockResolvedValue({ data: catalog });
    expect(await getPreferenceCatalog()).toEqual(catalog);
    http.get.mockResolvedValue({ data: { items: [{ ...catalog.items[0], authority: "all" }] } });
    await expect(getPreferenceCatalog()).rejects.toThrow();
    http.get.mockResolvedValue({ data: { items: [{ ...catalog.items[0], scope_key: "business" }] } });
    await expect(getPreferenceCatalog()).rejects.toThrow();
  });
  it("keeps list ownership in the server and accepts unavailable references only without leaked labels", async () => {
    http.get.mockResolvedValue({ data: { items: [preference], next_cursor: "opaque-next" } });
    expect((await getPreferences("opaque-start")).items[0].value).toBe("9007199254740993");
    expect(http.get).toHaveBeenCalledWith("/nodia-ai/preferences", { params: { page_limit: 20, cursor: "opaque-start" }, signal: undefined });
    http.get.mockResolvedValue({ data: { items: [{ ...preference, available: false }], next_cursor: null } });
    await expect(getPreferences()).rejects.toThrow();
    http.get.mockResolvedValue({ data: { items: [{ ...preference, available: false, value_label: null }], next_cursor: null } });
    expect((await getPreferences()).items[0].available).toBe(false);
  });
  it("validates IDs in discovered options and bounds search bytes before HTTP", async () => {
    http.get.mockResolvedValue({ data: { items: [{ id: preference.value, label: "Synthetic food" }], next_cursor: null } });
    expect((await getPreferenceOptions({ scope_key: "finance", key: "expense_category_id" })).items).toHaveLength(1);
    http.get.mockResolvedValue({ data: { items: [{ id: "9223372036854775808", label: "overflow" }], next_cursor: null } });
    await expect(getPreferenceOptions({ scope_key: "finance", key: "expense_category_id" })).rejects.toThrow();
    http.get.mockClear();
    await expect(getPreferenceOptions({ scope_key: "finance", key: "expense_category_id", search: "é".repeat(65) })).rejects.toThrow();
    expect(http.get).not.toHaveBeenCalled();
  });
  it("prepares a closed proposal and never saves a preference directly", async () => {
    http.post.mockResolvedValue({ data: prepared });
    expect(await preparePreference(createInput)).toEqual(prepared);
    expect(http.post).toHaveBeenCalledExactlyOnceWith("/nodia-ai/preferences/prepare", createInput);
    http.post.mockClear();
    await expect(preparePreference({ ...createInput, secret: "synthetic-not-allowed" } as typeof createInput)).rejects.toThrow();
    await expect(preparePreference({ ...createInput, scope_key: "business", key: "supplier_id" })).rejects.toThrow();
    expect(http.post).not.toHaveBeenCalled();
  });
  it("rejects a response that substitutes a different operation or target", async () => {
    http.post.mockResolvedValue({ data: prepared });
    await expect(preparePreference({ conversation_id: createInput.conversation_id, operation: "delete", preference_id: preference.preference_id, expected_revision: 3 })).rejects.toThrow();
  });
});
