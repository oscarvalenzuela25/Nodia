import { AxiosError, CanceledError } from "axios";
import { CancelledError } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import { getHttpErrorMessage, notifyHttpError } from "../../config/httpFeedback";
import { notifyAuthError } from "../../services/authFeedback";
import { queryClient } from "../../config/reactQuery";

vi.mock("sileo", () => ({ sileo: { error: vi.fn() } }));

describe("HTTP query feedback", () => {
  beforeEach(() => { vi.clearAllMocks(); queryClient.clear(); });
  it("notifies once for a failed query observed more than once", async () => {
    const error = new Error("network failure");
    await expect(queryClient.fetchQuery({ queryKey: ["failed"], queryFn: () => Promise.reject(error) })).rejects.toBe(error);
    notifyHttpError(error);
    expect(sileo.error).toHaveBeenCalledTimes(1);
  });
  it("ignores transport and query cancellations", () => {
    notifyHttpError(new CanceledError());
    notifyHttpError(new CancelledError());
    expect(sileo.error).not.toHaveBeenCalled();
  });
  it("preserves server validation messages without exposing transport details", () => {
    const error = new AxiosError("internal URL");
    Object.assign(error, { response: { data: { message: ["Invalid invoice", "Invalid stock"] } } });
    expect(getHttpErrorMessage(error)).toBe("Invalid invoice. Invalid stock");
    expect(getHttpErrorMessage(new Error("private details"))).not.toContain("private details");
  });
  it("does not repeat auth feedback when a failed refresh reaches the query cache", () => {
    const error = new AxiosError("expired");
    notifyAuthError(error, "auth:session_expired");
    notifyHttpError(error);
    expect(sileo.error).toHaveBeenCalledTimes(1);
  });

});
