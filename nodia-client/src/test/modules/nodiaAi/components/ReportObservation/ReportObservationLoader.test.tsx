import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReportObservationLoader from "../../../../../modules/nodiaAi/components/ReportObservation/ReportObservationLoader";
import { toolRef } from "../../infrastructure/observationFixtures";

const mocks = vi.hoisted(() => ({ load: vi.fn(), error: vi.fn() }));
vi.mock("../../../../../modules/nodiaAi/components/ReportObservation/loadReportObservation", () => ({ loadReportObservation: mocks.load }));
vi.mock("../../../../../config/httpFeedback", () => ({ notifyHttpError: mocks.error }));
beforeEach(() => vi.clearAllMocks());
describe("Report panel loading by intent", () => {
  it("recovers an import failure locally without reload or losing the reference", async () => {
    mocks.load.mockRejectedValueOnce(new Error("synthetic chunk unavailable")).mockResolvedValue({ default: ({ resultRef }: { resultRef: typeof toolRef }) => <p>{resultRef.tool_call_id}</p> });
    render(<ReportObservationLoader resultRef={toolRef} />);
    await userEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(toolRef.tool_call_id)).toBeInTheDocument();
    expect(mocks.load).toHaveBeenCalledTimes(2);
    expect(mocks.error).toHaveBeenCalledTimes(1);
  });
  it("ignores a failed import after its report was closed", async () => {
    let reject: ((error: Error) => void) | undefined;
    mocks.load.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
    const { unmount } = render(<ReportObservationLoader resultRef={toolRef} />);
    unmount();
    await act(async () => reject?.(new Error("synthetic late chunk failure")));
    expect(mocks.error).not.toHaveBeenCalled();
  });
});
