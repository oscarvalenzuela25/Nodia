import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BusinessModal from "../../../../../../../modules/business/pages/Business/components/BusinessModal";
import type { BusinessEntity } from "../../../../../../../modules/business/infrastructure/types";

describe("BusinessModal optional description", () => {
  it("creates with only a name and no empty translation records", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BusinessModal open onClose={vi.fn()} onSubmit={onSubmit} />);
    const save = screen.getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText(/Nombre del negocio/), "  Nuevo negocio  ");
    await user.click(save);
    expect(onSubmit).toHaveBeenCalledWith({ name: "Nuevo negocio", is_active: true, translates: [] });
  });

  it("allows a description in Spanish without requiring English", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BusinessModal open onClose={vi.fn()} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/Nombre del negocio/), "Negocio");
    await user.type(screen.getByLabelText("Descripción"), "Descripción opcional");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ translates: [{ key: "description", es: "Descripción opcional", en: "" }] }));
  });

  it("sends empty translations when clearing an existing description", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const initialData: BusinessEntity = {
      id: "biz-1", name: "Negocio", owner_id: "42", is_active: true,
      has_description: true, created_at: "2026-10-05", updated_at: "2026-10-05",
      translates: [{ key: "description", es: "Descripción anterior", en: "" }],
    };
    render(<BusinessModal open initialData={initialData} onClose={vi.fn()} onSubmit={onSubmit} />);
    await user.clear(screen.getByLabelText("Descripción"));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ id: "biz-1", translates: [{ key: "description", es: "", en: "" }] }));
  });
});
