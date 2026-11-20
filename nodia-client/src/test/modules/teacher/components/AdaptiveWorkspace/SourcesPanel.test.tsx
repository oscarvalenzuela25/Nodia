import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SourcesPanel from "../../../../../modules/teacher/components/AdaptiveWorkspace/SourcesPanel";
import type { AdaptivePanelProps } from "../../../../../modules/teacher/components/AdaptiveWorkspace/types";

const { execute, readSource } = vi.hoisted(() => ({ execute: vi.fn(), readSource: vi.fn() }));
vi.mock("../../../../../modules/teacher/components/AdaptiveWorkspace/useEnrichment", () => ({
  useEnrichment: () => ({
    query: { data: { sources: [], has_more: false } },
    disabled: false,
    readDisabled: false,
    execute,
    page: 1,
    setPage: vi.fn(),
  }),
}));
vi.mock("../../../../../modules/teacher/infrastructure/useServices", () => ({
  useTeacherQuery: (path: string) => ({ data: readSource(path), isLoading: false, isFetching: false, isError: false }),
}));

const props = {
  session: { id: "study-session" },
  visible: true,
  busy: false,
} as AdaptivePanelProps;
const sourceId = "09d2a99b-0105-430a-af7d-19eab2d6f29a";

function pdfFile() {
  const bytes = new TextEncoder().encode("%PDF-example");
  const file = new File([bytes], "Apuntes de enlaces.pdf", { type: "application/pdf" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  return file;
}

beforeEach(() => {
  execute.mockReset();
  readSource.mockReset();
});

describe("source formats in Teacher", () => {
  it("rejects image files locally and keeps the text draft when returning from PDF mode", async () => {
    const user = userEvent.setup();
    render(<SourcesPanel {...props} />);
    await user.type(screen.getByRole("textbox", { name: /Título de la fuente/ }), "Mi nota");
    await user.type(screen.getByRole("textbox", { name: /Contenido de texto/ }), "Texto de la imagen");
    await user.click(screen.getByRole("button", { name: "Subir PDF" }));
    const fileInput = screen.getByLabelText("Elegir PDF", { selector: "input" });
    fireEvent.change(fileInput, { target: { files: [new File(["image"], "foto.png", { type: "image/png" })] } });

    expect(screen.getByRole("alert")).toHaveTextContent("Selecciona un PDF");
    expect(screen.getByRole("button", { name: "Guardar fuente" })).toBeDisabled();
    expect(execute).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Pegar texto" }));
    expect(screen.getByRole("textbox", { name: /Título de la fuente/ })).toHaveValue("Mi nota");
    expect(screen.getByRole("textbox", { name: /Contenido de texto/ })).toHaveValue("Texto de la imagen");
    expect(screen.getByRole("button", { name: "Guardar fuente" })).toBeEnabled();
  });

  it("keeps the selected PDF on a failed save and reads the confirmed PDF source after success", async () => {
    const user = userEvent.setup();
    execute.mockResolvedValueOnce(null).mockResolvedValueOnce({ kind: "learning_source", resource_id: sourceId });
    readSource.mockImplementation(path => path.endsWith(sourceId) ? {
      id: sourceId, title: "Mi PDF",
      notices: ["teacher:source_page_without_text", "teacher:source_page_without_text"],
      pages: [{ page: 1, text: "Enlaces entre páginas" }, { page: 2, text: "" }],
    } : undefined);

    render(<SourcesPanel {...props} />);
    const title = screen.getByRole("textbox", { name: /Título de la fuente/ });
    await user.type(title, "Mi PDF");
    await user.click(screen.getByRole("button", { name: "Subir PDF" }));
    await user.upload(screen.getByLabelText("Elegir PDF", { selector: "input" }), pdfFile());
    const submit = screen.getByRole("button", { name: "Guardar fuente" });
    await user.click(submit);

    expect(execute).toHaveBeenCalledExactlyOnceWith("source_create", {
      title: "Mi PDF", media_type: "application/pdf", base64: "JVBERi1leGFtcGxl",
    });
    expect(screen.getByText("Apuntes de enlaces.pdf")).toBeVisible();
    expect(title).toHaveValue("Mi PDF");

    await user.click(submit);
    await screen.findByText("Enlaces entre páginas");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(readSource).toHaveBeenCalledWith("sessions/study-session/enrichment/sources/" + sourceId);
    expect(screen.getByText("Esta página no tiene texto extraíble.")).toBeVisible();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    await waitFor(() => expect(title).toHaveValue(""));
    expect(screen.queryByText("Apuntes de enlaces.pdf")).not.toBeInTheDocument();
  });
});
