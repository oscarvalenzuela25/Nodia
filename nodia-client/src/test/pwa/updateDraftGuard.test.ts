import { afterEach, describe, expect, it } from "vitest";
import { hasOpenUpdateDraft, watchUpdateDrafts } from "../../pwa/updateDraftGuard";

const edited = new Set<Element>();
let stop = () => {};

afterEach(() => {
  stop();
  edited.clear();
  document.body.replaceChildren();
});

describe("protecting local work before a PWA reload", () => {
  it("preserves edits until the form is removed or explicitly reset", async () => {
    const form = document.createElement("form");
    const input = form.appendChild(document.createElement("input"));
    document.body.append(form);
    stop = watchUpdateDrafts(document, edited);
    expect(hasOpenUpdateDraft(document, edited)).toBe(false);

    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(hasOpenUpdateDraft(document, edited)).toBe(true);
    form.reset();
    await Promise.resolve();
    expect(hasOpenUpdateDraft(document, edited)).toBe(false);

    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(hasOpenUpdateDraft(document, edited)).toBe(true);
    form.remove();
    expect(hasOpenUpdateDraft(document, edited)).toBe(false);
  });

  it("protects open modal dialogs and chat work even without an input event", () => {
    const dialog = document.createElement("section");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    document.body.append(dialog);
    expect(hasOpenUpdateDraft(document, edited)).toBe(true);
    dialog.remove();

    const chat = document.createElement("main");
    chat.dataset.pageLayout = "conversation";
    document.body.append(chat);
    expect(hasOpenUpdateDraft(document, edited)).toBe(true);
  });
});
