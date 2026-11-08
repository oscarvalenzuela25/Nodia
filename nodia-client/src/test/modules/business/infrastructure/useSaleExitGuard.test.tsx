import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { leavesPointOfSale, useSaleExitGuard } from "../../../../modules/business/infrastructure/useSaleExitGuard";
const stub = vi.hoisted(() => ({ blocker: { state: "blocked", proceed: vi.fn(), reset: vi.fn() } }));
vi.mock("react-router", async (original) => ({ ...await original<typeof import("react-router")>(), useBlocker: () => stub.blocker }));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
describe("POS exit guard", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("guards leaving POS, not an in-POS URL update or opening POS from the sales history", () => {
    const current={ pathname: "/business/a" };
    expect(leavesPointOfSale("pos",current,{ ...current,search:"?section=products" })).toBe(true);
    expect(leavesPointOfSale("pos",current,{ ...current,search:"" })).toBe(true);
    expect(leavesPointOfSale("pos",current,{ pathname:"/business/b",search:"?section=pos" })).toBe(true);
    expect(leavesPointOfSale("pos",current,{ ...current,search:"?section=pos&search=x" })).toBe(false);
    expect(leavesPointOfSale("sales",current,{ ...current,search:"?section=pos" })).toBe(false);
  });
  it("keeps dirty carts until explicit confirmation and prevents duplicate discard/proceed", () => {
    const clearForExit=vi.fn().mockReturnValue(true);
    const { result }=renderHook(() => useSaleExitGuard({section:"pos",hasUnsaved:true,canDiscard:true,clearForExit}));
    expect(result.current.showDialog).toBe(true);
    expect(clearForExit).not.toHaveBeenCalled();
    act(() => { result.current.confirmLeave(); result.current.confirmLeave(); });
    expect(clearForExit).toHaveBeenCalledTimes(1);
    expect(stub.blocker.proceed).toHaveBeenCalledTimes(1);
  });
  it("resets a clean workspace without a prompt and refuses discard of a pending operation", () => {
    const clearForExit=vi.fn().mockReturnValue(true);
    const { result,unmount }=renderHook(() => useSaleExitGuard({section:"pos",hasUnsaved:false,canDiscard:true,clearForExit}));
    expect(result.current.showDialog).toBe(false);
    expect(clearForExit).toHaveBeenCalledOnce();
    unmount(); vi.clearAllMocks();
    const pending=renderHook(() => useSaleExitGuard({section:"pos",hasUnsaved:true,canDiscard:false,clearForExit}));
    act(() => pending.result.current.confirmLeave());
    expect(clearForExit).not.toHaveBeenCalled();
    expect(stub.blocker.proceed).not.toHaveBeenCalled();
  });
  it("stays on the page when local storage cannot commit the reset", () => {
    const clearForExit=vi.fn().mockReturnValue(false);
    const {result}=renderHook(() => useSaleExitGuard({section:"pos",hasUnsaved:true,canDiscard:true,clearForExit}));
    act(() => result.current.confirmLeave());
    expect(stub.blocker.proceed).not.toHaveBeenCalled();
    expect(result.current.showDialog).toBe(true);
  });
});
