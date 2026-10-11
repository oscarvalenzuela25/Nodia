import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import useShortcutDialog from "../../../../layouts/components/MobileBottomNav/hooks/useShortcutDialog";
import { loadShortcutDialog } from "../../../../layouts/components/MobileBottomNav/loadShortcutDialog";
import i18n from "../../../../translate";

vi.mock("sileo", () => ({ sileo: { error: vi.fn() } }));
const module = { default: () => <></> };
const deferred = () => {
  let resolve!: (value: typeof module) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<typeof module>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
afterEach(() => vi.clearAllMocks());

it("loads only on intent, prevents duplicate requests and reuses the component on subsequent openings", async () => {
  const pending = deferred();
  const load = vi.fn(() => pending.promise);
  const ready = vi.fn();
  const { result } = renderHook(() => useShortcutDialog("a:1:home", load));
  expect(load).not.toHaveBeenCalled();
  let opening!: Promise<void>;
  act(() => { opening = result.current.open(2, ready); void result.current.open(3, ready); });
  expect(load).toHaveBeenCalledTimes(1);
  expect(result.current.loadingSlot).toBe(2);
  await act(async () => { pending.resolve(module); await opening; });
  expect(result.current.Dialog).toBe(module.default);
  expect(result.current.loadingSlot).toBeNull();
  expect(ready).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.open(0, ready); });
  expect(load).toHaveBeenCalledTimes(1);
  expect(ready).toHaveBeenCalledTimes(2);
});

it("reports a translated failure once and retries locally without refreshing or opening an empty modal", async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error("chunk unavailable")).mockResolvedValue(module);
  const ready = vi.fn();
  const { result } = renderHook(() => useShortcutDialog("a:1:home", load));
  await act(async () => { await result.current.open(1, ready); });
  expect(result.current.failed).toBe(true);
  expect(result.current.Dialog).toBeNull();
  expect(result.current.loadingSlot).toBeNull();
  expect(ready).not.toHaveBeenCalled();
  expect(sileo.error).toHaveBeenCalledExactlyOnceWith({ title: i18n.t("layout:mobile_nav.editor_load_error") });
  await act(async () => { await result.current.open(1, ready); });
  expect(load).toHaveBeenCalledTimes(2);
  expect(result.current.failed).toBe(false);
  expect(ready).toHaveBeenCalledOnce();
});

it.each(["b:2:home", "a:2:home", "a:1:reservations"])("ignores a late import after scope changes to %s", async nextScope => {
  const first = deferred(); const second = deferred();
  const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const staleReady = vi.fn(); const ready = vi.fn();
  const { result, rerender } = renderHook(({ scope }) => useShortcutDialog(scope, load), { initialProps: { scope: "a:1:home" } });
  let stale!: Promise<void>; let current!: Promise<void>;
  act(() => { stale = result.current.open(0, staleReady); });
  rerender({ scope: nextScope });
  expect(result.current.loadingSlot).toBeNull();
  act(() => { current = result.current.open(2, ready); });
  await act(async () => { first.reject(new Error("late failure")); await stale; });
  expect(staleReady).not.toHaveBeenCalled();
  expect(sileo.error).not.toHaveBeenCalled();
  expect(result.current.loadingSlot).toBe(2);
  await act(async () => { second.resolve(module); await current; });
  expect(ready).toHaveBeenCalledOnce();
});

it("does not open or notify after the navigation unmounts", async () => {
  const pending = deferred(); const ready = vi.fn();
  const { result, unmount } = renderHook(() => useShortcutDialog("a:1:home", () => pending.promise));
  let opening!: Promise<void>;
  act(() => { opening = result.current.open(0, ready); });
  unmount();
  await act(async () => { pending.reject(new Error("offline")); await opening; });
  expect(ready).not.toHaveBeenCalled();
  expect(sileo.error).not.toHaveBeenCalled();
});

it("shares the actual successful dynamic import across callers", async () => {
  const first = loadShortcutDialog();
  const second = loadShortcutDialog();
  expect(second).toBe(first);
  expect((await first).default).toEqual(expect.any(Function));
  expect(loadShortcutDialog()).toBe(first);
});
