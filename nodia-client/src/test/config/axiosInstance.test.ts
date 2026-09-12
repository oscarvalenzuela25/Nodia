import { AxiosError } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAxiosInstance } from "../../config/axiosInstance";
import i18n from "../../translate";

afterEach(async () => {
  await i18n.changeLanguage("es");
});

function rejectedRequest(status: number, code: string, retryAfter?: string) {
  const adapter = vi.fn(async (config) => {
    throw new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, undefined, {
      config,
      status,
      statusText: "Error",
      headers: retryAfter ? { "retry-after": retryAfter } : {},
      data: { error: code, message: "core:rate_limit_exceeded" },
    });
  });
  return { adapter, request: createAxiosInstance({ adapter }).get("/users") };
}

describe("rate limit feedback", () => {
  it.each([
    ["es", "Demasiadas solicitudes. Vuelve a intentarlo en 5 s."],
    ["en", "Too many requests. Try again in 5 s."],
  ])("translates 429 feedback in %s without retrying", async (language, message) => {
    await i18n.changeLanguage(language);
    const { request, adapter } = rejectedRequest(429, "RATE_LIMIT_EXCEEDED", "5");
    await expect(request).rejects.toMatchObject({
      message,
      response: { status: 429, data: { message } },
    });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, "invalid", "0", "-1"])(
    "uses translated fallback for Retry-After=%s",
    async (retryAfter) => {
      await i18n.changeLanguage("en");
      const { request } = rejectedRequest(429, "RATE_LIMIT_EXCEEDED", retryAfter);
      await expect(request).rejects.toMatchObject({
        message: "Too many requests. Wait a moment before trying again.",
      });
    },
  );

  it("distinguishes storage unavailability from quota exhaustion", async () => {
    await i18n.changeLanguage("en");
    const { request } = rejectedRequest(503, "RATE_LIMIT_UNAVAILABLE");
    await expect(request).rejects.toMatchObject({
      message: "The service is temporarily unavailable. Please try again later.",
      response: { status: 503 },
    });
  });
});
