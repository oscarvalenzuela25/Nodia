import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import LessonMarkdown from "../../../../../modules/teacher/components/LessonMarkdown";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });

function clipboard(writeText?: (text: string) => Promise<void>) {
  vi.stubGlobal("navigator", { clipboard: writeText ? { writeText } : undefined });
}

describe("LessonMarkdown", () => {
  it("copies only the selected block, preserving indentation, newlines and literal HTML", async () => {
    const source = '<main>\n  <p>Hello & welcome</p>\n</main>\n';
    const writeText = vi.fn().mockResolvedValue(undefined); clipboard(writeText);
    render(<LessonMarkdown text={'Before\n\n```html\n' + source + '```\n\n```css\n.card { color: red; }\n```\nAfter'} />);
    expect(screen.getByText(".html")).toBeVisible(); expect(screen.getByText(".css")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Copiar código" })[0]);
    await waitFor(() => expect(sileo.success).toHaveBeenCalledExactlyOnceWith({ title: "Código copiado" }));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(source);
    expect(document.querySelector("main")).toBeNull();
    expect(screen.getByText("Before")).toBeVisible(); expect(screen.getByText("After")).toBeVisible();
  });

  it("keeps inline code inline and unlabelled or unknown languages honest and copyable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined); clipboard(writeText);
    render(<LessonMarkdown text={'Use `display: flex` here.\n\n```\n  plain\n```\n\n```newlang\nunknown\n```\n\n```typescript\nconst x = 1;\n```'} />);
    expect(screen.getByText("display: flex").closest("pre")).toBeNull();
    expect(screen.getByText("Código")).toBeVisible(); expect(screen.getByText("newlang")).toBeVisible(); expect(screen.getByText(".ts")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Copiar código" })).toHaveLength(3);
    fireEvent.click(screen.getAllByRole("button", { name: "Copiar código" })[1]);
    await waitFor(() => expect(writeText).toHaveBeenCalledExactlyOnceWith("unknown\n"));
  });

  it("blocks duplicate copies until the clipboard write resolves and supports keyboard activation", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const writeText = vi.fn(() => new Promise<void>(resolve => { finish = resolve; })); clipboard(writeText);
    render(<LessonMarkdown text={'```css\na { color: red; }\n```'} />);
    const button = screen.getByRole("button", { name: "Copiar código" }); button.focus();
    await user.keyboard("{Enter}"); expect(button).toBeDisabled(); fireEvent.click(button);
    expect(writeText).toHaveBeenCalledTimes(1);
    await act(async () => finish()); expect(button).toBeEnabled();
    expect(sileo.success).toHaveBeenCalledTimes(1);
  });

  it.each(["missing", "rejected"])("keeps selectable code and reports a %s clipboard without claiming success", async (kind) => {
    clipboard(kind === "rejected" ? vi.fn().mockRejectedValue(new Error("denied")) : undefined);
    render(<LessonMarkdown text={'```js\nconst sample = true;\n```'} />);
    const button = screen.getByRole("button", { name: "Copiar código" }); fireEvent.click(button);
    await waitFor(() => expect(sileo.error).toHaveBeenCalledExactlyOnceWith({ title: "No se pudo copiar el código", description: "Selecciona el código y cópialo manualmente." }));
    expect(sileo.success).not.toHaveBeenCalled(); expect(button).toBeEnabled();
    expect(screen.getByText("const sample = true;")).toBeVisible();
  });

  it("does not render raw HTML or images as executable lesson content", () => {
    render(<LessonMarkdown text={'<script>alert(1)</script>\n\n![remote](https://example.invalid/image)\n\n```html\n<img src=x onerror=alert(1)>\n```'} />);
    expect(document.querySelector("script")).toBeNull(); expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeVisible();
  });
});
