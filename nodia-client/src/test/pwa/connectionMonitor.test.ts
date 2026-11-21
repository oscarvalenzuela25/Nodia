import { AxiosError, CanceledError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { createConnectionMonitor, getConnectionIssue, offlineRequestCode } from "../../pwa/connectionMonitor";

const networkError = new AxiosError("Transport failure", "ERR_NETWORK");
const httpError = (status: number) => Object.assign(new AxiosError("HTTP failure"), { response: { status } });

describe("connection failure classification", () => {
  it("uses the browser signal only for failures without an HTTP response", () => {
    expect(getConnectionIssue(networkError, true)).toBe("offline");
    expect(getConnectionIssue(networkError, false)).toBe("server-unavailable");
    expect(getConnectionIssue(httpError(503), false)).toBe("server-unavailable");
    expect(getConnectionIssue(new AxiosError("Not sent", offlineRequestCode), true)).toBe("offline");
  });

  it.each([400, 401, 403, 404, 410, 429])("keeps HTTP %i separate from reachability", (status) => {
    expect(getConnectionIssue(httpError(status), true)).toBeUndefined();
  });

  it("ignores intentionally canceled requests", () => {
    expect(getConnectionIssue(new CanceledError(), false)).toBeUndefined();
  });
});

describe("connection recovery", () => {
  it("coalesces retry clicks and only recovers reads when the API responds", async () => {
    let offline = true;
    const probe = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const recoverReads = vi.fn().mockResolvedValue(undefined);
    const monitor = createConnectionMonitor({ isOffline: () => offline, probe });
    await monitor.retry(recoverReads);
    expect(probe).not.toHaveBeenCalled();
    expect(monitor.getSnapshot()).toEqual({ status: "offline", checking: false });

    offline = false;
    const check = monitor.retry(recoverReads);
    expect(monitor.retry(recoverReads)).toBe(check);
    expect(monitor.getSnapshot().checking).toBe(true);
    await check;
    expect(monitor.getSnapshot()).toEqual({ status: "server-unavailable", checking: false });
    expect(recoverReads).not.toHaveBeenCalled();
    await monitor.retry(recoverReads);
    expect(recoverReads).toHaveBeenCalledOnce();
    expect(monitor.getSnapshot()).toEqual({ status: "available", checking: false });
  });

  it("keeps the server warning if a business read fails after a successful liveness probe", async () => {
    const monitor = createConnectionMonitor({ isOffline: () => false, probe: async () => true });
    monitor.observeFailure(networkError);
    await monitor.retry(async () => { monitor.observeFailure(httpError(503)); });
    expect(monitor.getSnapshot()).toEqual({ status: "server-unavailable", checking: false });
  });

  it("discards a successful result from before a new network drop", async () => {
    let offline = false;
    let resolveProbe!: (reachable: boolean) => void;
    const probe = new Promise<boolean>((resolve) => { resolveProbe = resolve; });
    const reads = vi.fn().mockResolvedValue(undefined);
    const monitor = createConnectionMonitor({ isOffline: () => offline, probe: () => probe });
    const stale = monitor.retry(reads);
    await Promise.resolve();
    offline = true;
    monitor.offline();
    resolveProbe(true);
    await stale;
    expect(reads).not.toHaveBeenCalled();
    expect(monitor.getSnapshot()).toEqual({ status: "offline", checking: false });
  });
});
