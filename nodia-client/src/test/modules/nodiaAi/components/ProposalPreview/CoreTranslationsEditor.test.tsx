import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CoreTranslationsEditor from "../../../../../modules/nodiaAi/components/ProposalPreview/CoreTranslationsEditor";

describe("Core translations structured editor", () => {
  it("uses translated ES/EN fields and keeps row identity when changing a value", () => {
    const onChange = vi.fn();
    render(<CoreTranslationsEditor label="Translations" value={[{ row_id: "row-a", key: "name", es: "Nombre", en: "Name" }]} onChange={onChange} disabled={false} error={false} maximum="100" />);
    fireEvent.change(screen.getByDisplayValue("Nombre"), { target: { value: "Nombre revisado" } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith([{ row_id: "row-a", key: "name", es: "Nombre revisado", en: "Name" }]);
  });
  it("shows empty state and disables structural actions while busy", () => {
    render(<CoreTranslationsEditor label="Translations" value={[]} onChange={vi.fn()} disabled error={false} maximum="100" />);
    expect(screen.getByText("Sin traducciones. Puedes agregar una entrada.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar traducción" })).toBeDisabled();
  });
});
