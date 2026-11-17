import { describe, expect, it, vi } from "vitest";
import { createProviderContactsLoader } from "../../../../../../../modules/business/pages/BusinessDetail/components/ProvidersTab/loadProviderContacts";

const contactsModule = { default: () => <div /> };

describe("provider contacts import cache", () => {
  it("loads only on intent, shares concurrent downloads and retains successful code", async () => {
    let resolve!: (value: typeof contactsModule) => void;
    const importer = vi.fn(() => new Promise<typeof contactsModule>(done => { resolve = done; }));
    const load = createProviderContactsLoader(importer);
    expect(importer).not.toHaveBeenCalled();
    const first = load();
    expect(load()).toBe(first);
    expect(importer).toHaveBeenCalledOnce();
    resolve(contactsModule);
    expect(await first).toBe(contactsModule);
    expect(load()).toBe(first);
    expect(importer).toHaveBeenCalledOnce();
  });

  it("releases a rejected download for a local retry", async () => {
    const importer = vi.fn().mockRejectedValueOnce(new Error("chunk unavailable")).mockResolvedValue(contactsModule);
    const load = createProviderContactsLoader(importer);
    const first = load();
    expect(load()).toBe(first);
    await expect(first).rejects.toThrow("chunk unavailable");
    const retry = load();
    expect(retry).not.toBe(first);
    expect(await retry).toBe(contactsModule);
    expect(load()).toBe(retry);
    expect(importer).toHaveBeenCalledTimes(2);
  });
});
