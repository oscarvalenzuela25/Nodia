import envs from "../../../config/.envs";
import { apiPath } from "../../../config/apiPath";
import { isStudyRecord } from "./offlineStudyIdentity";

export function hasUnexpiredAccessToken(token: string): boolean {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims: unknown = JSON.parse(atob(part));
    return isStudyRecord(claims) && typeof claims.exp === "number" && claims.exp * 1000 > Date.now();
  } catch { return false; }
}

type RequestOptions = {
  signal?: AbortSignal;
  write?: { key: string; body: object };
};

export async function requestOfflineTeacher(path: string, token: string, { signal, write }: RequestOptions = {}) {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 8_000);
  try {
    const base = envs.API_URL.replace(/\/$/, "");
    const response = await fetch(base + apiPath(`/teacher/${path}`), {
      method: write ? "PATCH" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(write ? { "Content-Type": "application/json", "Idempotency-Key": write.key } : {}),
      },
      body: write ? JSON.stringify(write.body) : undefined,
      cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal,
    });
    const data: unknown = response.headers.get("Content-Type")?.includes("application/json")
      ? await response.json() : null;
    return { status: response.status, data };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
