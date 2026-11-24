import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CvPdfIntegrityError, verifyCvPdfBytes } from "../../../../modules/nodiaCv/infrastructure/pdfVersions";
import { cvPdfErrorMessage } from "../../../../modules/nodiaCv/infrastructure/pdfFeedback";
import i18n from "../../../../translate";

function pdfBytes(content: string) {
  const buffer = new ArrayBuffer(content.length);
  new Uint8Array(buffer).set(Array.from(content, (char) => char.charCodeAt(0)));
  return buffer;
}

describe("exact PDF delivery", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  it("accepts the expected bytes only when their actual digest matches the signed metadata and header", async () => {
    const content = "%PDF-1.7 synthetic fixture";
    const sha256 = createHash("sha256").update(content).digest("hex");
    const buffer = pdfBytes(content);
    await expect(verifyCvPdfBytes(buffer, "application/pdf", sha256, sha256)).resolves.toEqual({ buffer, sha256 });
    await expect(verifyCvPdfBytes(pdfBytes(content + "!"), "application/pdf", sha256, sha256)).rejects.toBeInstanceOf(CvPdfIntegrityError);
    await expect(verifyCvPdfBytes(buffer, "application/pdf", "a".repeat(64), sha256)).rejects.toBeInstanceOf(CvPdfIntegrityError);
  });

  it("rejects HTML fallback, missing PDF signature and an unexposed digest header", async () => {
    const content = "This is an HTML error response";
    const sha256 = createHash("sha256").update(content).digest("hex");
    const buffer = pdfBytes(content);
    await expect(verifyCvPdfBytes(buffer, "text/html", sha256, sha256)).rejects.toBeInstanceOf(CvPdfIntegrityError);
    await expect(verifyCvPdfBytes(buffer, "application/pdf", sha256, sha256)).rejects.toBeInstanceOf(CvPdfIntegrityError);
    await expect(verifyCvPdfBytes(pdfBytes("%PDF-1.7"), "application/pdf", null, sha256)).rejects.toBeInstanceOf(CvPdfIntegrityError);
  });

  it("communicates safe failure codes from binary endpoints while protecting unrelated response text", () => {
    const error = (message: string) => ({
      isAxiosError: true,
      response: {
        status: 404, data: pdfBytes(JSON.stringify({ message })), headers: { "content-type": "application/json; charset=utf-8" },
      },
    });
    expect(cvPdfErrorMessage(error("nodiaCv:pdf_not_found"))).toBe(i18n.t("nodiaCv:pdf_not_found"));
    expect(cvPdfErrorMessage(error("private upstream error"))).toBe(i18n.t("core:server_error_toast"));
  });
});
