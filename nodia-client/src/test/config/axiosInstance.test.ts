import { AxiosError, type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAxiosInstance, getServerErrorCode } from "../../config/axiosInstance";
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

describe("image-generation backend feedback", () => {
  it.each([
    ["es", "invalid_image_generation_request", "Escribe /imagen seguido de una descripción de entre 1 y 8000 bytes UTF-8, sin adjuntar archivos."],
    ["en", "invalid_image_generation_request", "Type /imagen followed by a description between 1 and 8,000 UTF-8 bytes, without attachments."],
    ["es", "invalid_generated_image", "No pudimos validar la imagen recibida del proveedor."],
    ["en", "invalid_generated_image", "We could not validate the image received from the provider."],
    ["es", "generated_image_storage_unavailable", "No pudimos guardar la imagen generada. Consulta el estado de la conversación antes de solicitar otra."],
    ["en", "generated_image_storage_unavailable", "We could not store the generated image. Check the conversation status before requesting another one."],
  ])("translates %s/%s while preserving the server code", async (language, key, message) => {
    await i18n.changeLanguage(language);
    const code = `nodia_ai:${key}`;
    const adapter = vi.fn<AxiosAdapter>(async config => {
      throw new AxiosError("Synthetic backend error", "ERR_BAD_RESPONSE", config, undefined,
        { config, status: 400, statusText: "Bad Request", headers: {}, data: { message: code } });
    });
    const error: unknown = await createAxiosInstance({ adapter }).post("/synthetic-image-request").catch((cause: unknown) => cause);
    expect(error).toMatchObject({ message, response: { data: { message } } });
    expect(getServerErrorCode(error)).toBe(code);
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});
