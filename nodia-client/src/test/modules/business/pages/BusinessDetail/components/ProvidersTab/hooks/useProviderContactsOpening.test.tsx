import { act, fireEvent, render, screen, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import useAuthStore from "../../../../../../../../store/authStore";
import i18n from "../../../../../../../../translate";
import type { ProviderEntity } from "../../../../../../../../modules/business/infrastructure/types";
import useProviderContactsOpening from "../../../../../../../../modules/business/pages/BusinessDetail/components/ProvidersTab/hooks/useProviderContactsOpening";

vi.mock("sileo", () => ({ sileo: { error: vi.fn() } }));
const contactsModule = { default: () => <div /> };
const provider: ProviderEntity = { id: "supplier-1", business_id: "business-1", name: "Synthetic", tax: 19, is_active: true, created_at: "2026-11-16" };
const deferred = () => {
  let resolve!: (value: typeof contactsModule) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<typeof contactsModule>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
beforeEach(() => {
  useAuthStore.setState({ user: { id: "actor-1", name: "Synthetic" }, token: "synthetic-token", sessionVersion: 1,
    sessionStatus: "authenticated", isRefreshing: false, expiresAt: Date.now() + 3600000 });
});
afterEach(() => { vi.clearAllMocks(); document.body.replaceChildren(); });

describe("provider contacts opening", () => {
  it("loads only on demand, serializes opening and reuses the loaded component", async () => {
    const pending = deferred();
    const load = vi.fn(() => pending.promise);
    const ready = vi.fn();
    const { result } = renderHook(() => useProviderContactsOpening("business-1", ready, load));
    expect(load).not.toHaveBeenCalled();
    expect(result.current.Component).toBeNull();
    let opening!: Promise<void>;
    act(() => { opening = result.current.open(provider); void result.current.open({ ...provider, id: "supplier-2" }); });
    expect(load).toHaveBeenCalledOnce();
    expect(result.current.loadingProviderId).toBe(provider.id);
    await act(async () => { pending.resolve(contactsModule); await opening; });
    expect(result.current.Component).toBe(contactsModule.default);
    expect(result.current.loadingProviderId).toBeNull();
    expect(ready).toHaveBeenCalledExactlyOnceWith(provider);
    const second = { ...provider, id: "supplier-2" };
    await act(async () => { await result.current.open(second); });
    expect(load).toHaveBeenCalledOnce();
    expect(ready).toHaveBeenLastCalledWith(second);
  });

  it("keeps the parent closed, reports failure once, restores focus and permits retry", async () => {
    const opener = document.createElement("button");
    const elsewhere = document.createElement("button");
    document.body.append(opener, elsewhere);
    opener.focus();
    const first = deferred();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(contactsModule);
    const ready = vi.fn();
    const { result } = renderHook(() => useProviderContactsOpening("business-1", ready, load));
    let opening!: Promise<void>;
    act(() => { opening = result.current.open(provider); void result.current.open(provider); });
    elsewhere.focus();
    await act(async () => { first.reject(new Error("chunk unavailable")); await opening; });
    expect(result.current.failedProvider).toBe(provider);
    expect(result.current.loadingProviderId).toBeNull();
    expect(result.current.Component).toBeNull();
    expect(ready).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
    expect(sileo.error).toHaveBeenCalledExactlyOnceWith({ title: i18n.t("provider_contacts:load_error") });
    await act(async () => { await result.current.open(provider); });
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.failedProvider).toBeNull();
    expect(ready).toHaveBeenCalledExactlyOnceWith(provider);
  });

  it("restores focus after the loading commit has re-enabled the initiating button", async () => {
    const pending = deferred();
    const ready = vi.fn();
    function OpeningControl() {
      const { open, loadingProviderId } = useProviderContactsOpening("business-1", ready, () => pending.promise);
      return <>
        <button disabled={loadingProviderId !== null} onClick={() => { void open(provider); }}>Open contacts</button>
        <input aria-label="Other input" />
      </>;
    }
    render(<OpeningControl />);
    const opener = screen.getByRole("button", { name: "Open contacts" });
    opener.focus();
    fireEvent.click(opener);
    expect(opener).toBeDisabled();
    screen.getByRole("textbox", { name: "Other input" }).focus();
    await act(async () => { pending.reject(new Error("chunk unavailable")); await pending.promise.catch(() => undefined); });
    expect(opener).toBeEnabled();
    expect(opener).toHaveFocus();
    expect(ready).not.toHaveBeenCalled();
    expect(sileo.error).toHaveBeenCalledOnce();
  });

  it.each(["business", "actor", "session"] as const)("ignores a late import after changing %s context", async change => {
    const first = deferred();
    const second = deferred();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const ready = vi.fn();
    const { result, rerender } = renderHook(({ businessId }) => useProviderContactsOpening(businessId, ready, load), { initialProps: { businessId: "business-1" } });
    let stale!: Promise<void>;
    act(() => { stale = result.current.open(provider); });
    if (change === "business") rerender({ businessId: "business-2" });
    else act(() => { useAuthStore.setState(change === "actor" ? { user: { id: "actor-2", name: "Second" } } : { sessionVersion: 2 }); });
    expect(result.current.loadingProviderId).toBeNull();
    expect(result.current.failedProvider).toBeNull();
    const nextProvider = { ...provider, id: "supplier-2", business_id: change === "business" ? "business-2" : "business-1" };
    let current!: Promise<void>;
    act(() => { current = result.current.open(nextProvider); });
    await act(async () => { first.resolve(contactsModule); await stale; });
    expect(ready).not.toHaveBeenCalled();
    expect(result.current.Component).toBeNull();
    expect(result.current.loadingProviderId).toBe(nextProvider.id);
    await act(async () => { second.resolve(contactsModule); await current; });
    expect(ready).toHaveBeenCalledExactlyOnceWith(nextProvider);
    expect(sileo.error).not.toHaveBeenCalled();
  });

  it("does not notify or move focus for a rejected import from an obsolete business", async () => {
    const pending = deferred();
    const ready = vi.fn();
    const { result, rerender } = renderHook(({ businessId }) => useProviderContactsOpening(businessId, ready, () => pending.promise), { initialProps: { businessId: "business-1" } });
    const opener = document.createElement("button");
    const currentFocus = document.createElement("input");
    document.body.append(opener, currentFocus);
    opener.focus();
    let opening!: Promise<void>;
    act(() => { opening = result.current.open(provider); });
    rerender({ businessId: "business-2" });
    currentFocus.focus();
    await act(async () => { pending.reject(new Error("late failure")); await opening; });
    expect(currentFocus).toHaveFocus();
    expect(sileo.error).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
  });

  it.each(["success", "failure"] as const)("ignores %s after unmount", async outcome => {
    const pending = deferred();
    const ready = vi.fn();
    const { result, unmount } = renderHook(() => useProviderContactsOpening("business-1", ready, () => pending.promise));
    let opening!: Promise<void>;
    act(() => { opening = result.current.open(provider); });
    unmount();
    await act(async () => {
      if (outcome === "success") pending.resolve(contactsModule); else pending.reject(new Error("late failure"));
      await opening;
    });
    expect(ready).not.toHaveBeenCalled();
    expect(sileo.error).not.toHaveBeenCalled();
  });

  it("revalidates the live session before opening cached code and rejects a supplier from another business", async () => {
    const load = vi.fn().mockResolvedValue(contactsModule);
    const ready = vi.fn();
    const { result } = renderHook(() => useProviderContactsOpening("business-1", ready, load));
    await act(async () => { await result.current.open({ ...provider, business_id: "business-2" }); });
    expect(load).not.toHaveBeenCalled();
    await act(async () => { await result.current.open(provider); });
    ready.mockClear();
    await act(async () => {
      useAuthStore.setState({ expiresAt: Date.now() - 1 });
      await result.current.open(provider);
    });
    expect(ready).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledOnce();
  });
});
