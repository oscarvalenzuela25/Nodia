import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEnrichment } from "../../../../../modules/teacher/components/AdaptiveWorkspace/useEnrichment";
import type { AdaptivePanelProps } from "../../../../../modules/teacher/components/AdaptiveWorkspace/types";
vi.mock("../../../../../modules/teacher/infrastructure/useServices", () => ({ useTeacherQuery: () => ({ data: { revision: 3 }, isFetching: false }) }));
describe("historical enrichment reading", () => {
  it.each(["paused", "archived"] as const)("retains reading in %s while refusing mutations", async state => {
    const execute = vi.fn();
    const props = { session: { id: "fixture-session", state }, visible: true, busy: false, command: { execute }, onResult: vi.fn() } as unknown as AdaptivePanelProps;
    const { result } = renderHook(() => useEnrichment(props));
    expect(result.current.readDisabled).toBe(false);
    expect(result.current.disabled).toBe(true);
    expect(await result.current.execute("card_create", {})).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });
});
