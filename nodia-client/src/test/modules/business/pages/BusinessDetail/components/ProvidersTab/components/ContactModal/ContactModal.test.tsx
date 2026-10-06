import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactModal from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProvidersTab/components/ContactModal";
const close = vi.fn();
const save = vi.fn();
const mount = () =>
  render(
    <ContactModal
      providerName="Proveedor de prueba"
      busy={false}
      onClose={close}
      onSave={save}
    />,
  );
describe("ContactModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    save.mockResolvedValue(undefined);
  });
  it("starts with Chile, optional phone and collapsed schedule, and validates before adding another phone", async () => {
    const user = userEvent.setup();
    mount();
    expect(screen.getByText("Chile (+56)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Horario de visitas/ }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: "Agregar teléfono" }),
    ).toBeDisabled();
    await user.type(screen.getByLabelText("Teléfono 1"), "987654321");
    expect(
      screen.getByRole("button", { name: "Agregar teléfono" }),
    ).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Agregar teléfono" }));
    expect(screen.getByLabelText("Teléfono 2")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Agregar teléfono" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Quitar teléfono 2" }));
    expect(screen.queryByLabelText("Teléfono 2")).not.toBeInTheDocument();
  });
  it("saves name alone, without manufacturing phone numbers or schedule", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(
      screen.getByLabelText(/Nombre del contacto/),
      "María Pérez",
    );
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledWith(
      {
        name: "María Pérez",
        phone: [],
        email: null,
        schedule: {},
        description: null,
        is_active: true,
      },
      expect.any(String),
    );
  });
  it("rejects duplicated phone numbers without sending a request", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText(/Nombre del contacto/), "María");
    await user.type(screen.getByLabelText("Teléfono 1"), "987654321");
    await user.click(screen.getByRole("button", { name: "Agregar teléfono" }));
    await user.type(screen.getByLabelText("Teléfono 2"), "987654321");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(
      await screen.findByText("Este teléfono ya está agregado"),
    ).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
  it("expands a collapsed schedule when an invalid range prevents saving", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText(/Nombre del contacto/), "María");
    const schedule = screen.getByRole("button", { name: /Horario de visitas/ });
    await user.click(schedule);
    fireEvent.change(screen.getAllByLabelText("Desde")[0], {
      target: { value: "12:00" },
    });
    fireEvent.change(screen.getAllByLabelText("Hasta")[0], {
      target: { value: "09:00" },
    });
    await user.click(schedule);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(schedule).toHaveAttribute("aria-expanded", "true"),
    );
    expect(save).not.toHaveBeenCalled();
    expect(
      screen.getByText("Completa la hora de fin; debe ser posterior al inicio"),
    ).toBeInTheDocument();
  });
  it("preserves entered values and the modal after a server rejection", async () => {
    save.mockRejectedValue({ isAxiosError: true, response: { status: 400 } });
    const user = userEvent.setup();
    mount();
    await user.type(
      screen.getByLabelText(/Nombre del contacto/),
      "María Pérez",
    );
    await user.type(
      screen.getByLabelText("Comentarios (opcional)"),
      "No perder",
    );
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Nombre del contacto/)).toHaveValue(
      "María Pérez",
    );
    expect(screen.getByLabelText("Comentarios (opcional)")).toHaveValue(
      "No perder",
    );
    expect(screen.getByLabelText(/Nombre del contacto/)).toBeEnabled();
  });
  it("recovers an uncertain write with the identical key and payload", async () => {
    save
      .mockRejectedValueOnce(new Error("Lost response"))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText(/Nombre del contacto/), "María");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByRole("button", { name: "Verificar guardado" });
    expect(screen.getByLabelText(/Nombre del contacto/)).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Verificar guardado" }),
    );
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
  });
});
