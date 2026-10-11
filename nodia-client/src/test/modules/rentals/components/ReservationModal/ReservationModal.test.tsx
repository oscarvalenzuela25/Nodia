import { ui, property, reservation, resetUI } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReservationModal from "../../../../../modules/rentals/components/ReservationModal";
import i18n from "../../../../../translate";

beforeEach(resetUI);
it("seeds selected dates and retains guest and stay drafts when moving between creation steps", async () => {
  render(
    <ReservationModal
      property={property}
      open
      initialStay={{ check_in_on: "2026-11-08", check_out_on: "2026-11-10" }}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByLabelText(i18n.t("rental:check_in_on"))).toHaveValue(
    "2026-11-08",
  );
  fireEvent.change(screen.getByLabelText(i18n.t("rental:check_in_time")), {
    target: { value: "15:00" },
  });
  fireEvent.change(screen.getByLabelText(i18n.t("rental:check_out_time")), {
    target: { value: "11:00" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:wizard_continue") }),
  );
  const guest = await screen.findByLabelText(i18n.t("rental:guest_name"));
  fireEvent.change(guest, { target: { value: "Synthetic wizard guest" } });
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:wizard_back") }),
  );
  expect(screen.getByLabelText(i18n.t("rental:check_in_time"))).toHaveValue(
    "15:00",
  );
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:wizard_continue") }),
  );
  expect(screen.getByLabelText(i18n.t("rental:guest_name"))).toHaveValue(
    "Synthetic wizard guest",
  );
  expect(ui.execute).not.toHaveBeenCalled();
});
it("requires arrival and departure times for each guest agreement without inheriting legacy property times", async () => {
  render(
    <ReservationModal
      property={property}
      open
      initialData={reservation}
      onClose={vi.fn()}
    />,
  );
  const arrival = screen.getByLabelText(i18n.t("rental:check_in_time"));
  const departure = screen.getByLabelText(i18n.t("rental:check_out_time"));
  fireEvent.change(arrival, { target: { value: "" } });
  fireEvent.change(departure, { target: { value: "" } });
  fireEvent.submit(arrival.closest("form")!);
  await waitFor(() => expect(arrival).toHaveAttribute("aria-invalid", "true"));
  expect(departure).toHaveAttribute("aria-invalid", "true");
  expect(ui.execute).not.toHaveBeenCalled();
});
it("starts a new reservation without inheriting legacy property times", () => {
  render(<ReservationModal property={property} open onClose={vi.fn()} />);
  expect(screen.getByLabelText(i18n.t("rental:check_in_time"))).toHaveValue("");
  expect(screen.getByLabelText(i18n.t("rental:check_out_time"))).toHaveValue(
    "",
  );
});
it("keeps edited inputs open when the write is rejected", async () => {
  const row = { ...reservation, status: "confirmed" } as typeof reservation;
  ui.execute.mockRejectedValueOnce(new Error("known rejection"));
  const close = vi.fn();
  render(
    <ReservationModal
      property={property}
      open
      initialData={row}
      onClose={close}
    />,
  );
  const input = screen.getByLabelText(i18n.t("rental:notes"));
  fireEvent.change(input, { target: { value: "Edited after initial data" } });
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:save") }),
  );
  await waitFor(() =>
    expect(ui.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "reservation.update",
        data: expect.objectContaining({ notes: "Edited after initial data" }),
      }),
    ),
  );
  expect(close).not.toHaveBeenCalled();
  expect(input).toHaveValue("Edited after initial data");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("shows a saved international phone as country and national number without rewriting it on unrelated edits", async () => {
  const contact = "+1 202 555 0123";
  render(
    <ReservationModal
      property={property}
      open
      initialData={{
        ...reservation,
        status: "confirmed",
        guest_contact: contact,
      }}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByText("Estados Unidos (+1)")).toBeInTheDocument();
  expect(screen.getByLabelText(i18n.t("rental:guest_contact"))).toHaveValue(
    "2025550123",
  );
  fireEvent.change(screen.getByLabelText(i18n.t("rental:notes")), {
    target: { value: "Keep saved contact" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:save") }),
  );
  await waitFor(() =>
    expect(ui.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ guest_contact: contact }),
      }),
    ),
  );
});
it("submits the selected calling code and preserves country and number after rejection", async () => {
  ui.execute.mockRejectedValue(new Error("rejected"));
  const close = vi.fn();
  render(
    <ReservationModal
      property={property}
      open
      initialData={{
        ...reservation,
        status: "confirmed",
        guest_contact: "Legacy contact",
      }}
      onClose={close}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("core:phone_country") }),
  );
  await userEvent.click(
    await screen.findByRole("option", { name: "Estados Unidos (+1)" }),
  );
  fireEvent.change(screen.getByLabelText(i18n.t("rental:guest_contact")), {
    target: { value: "2025550123" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:save") }),
  );
  await waitFor(() =>
    expect(ui.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ guest_contact: "+12025550123" }),
      }),
    ),
  );
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByText("Estados Unidos (+1)")).toBeInTheDocument();
  expect(screen.getByLabelText(i18n.t("rental:guest_contact"))).toHaveValue(
    "2025550123",
  );
  expect(ui.execute.mock.calls[0][0].data).not.toHaveProperty("contactCountry");
});
it("rejects an edited incomplete phone, focuses its input, and still accepts another contact detail", async () => {
  render(
    <ReservationModal
      property={property}
      open
      initialData={{
        ...reservation,
        status: "confirmed",
        guest_contact: "Legacy contact",
      }}
      onClose={vi.fn()}
    />,
  );
  const input = screen.getByLabelText(i18n.t("rental:guest_contact"));
  fireEvent.change(input, { target: { value: "123" } });
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:save") }),
  );
  expect(
    await screen.findByText(i18n.t("rental:invalid_guest_phone")),
  ).toBeInTheDocument();
  expect(ui.execute).not.toHaveBeenCalled();
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: "guest@example.test" } });
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:save") }),
  );
  await waitFor(() =>
    expect(ui.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ guest_contact: "guest@example.test" }),
      }),
    ),
  );
});
it("pasting an international phone detects its country and keeps both controls across wizard steps", async () => {
  render(
    <ReservationModal
      property={property}
      open
      initialStay={{ check_in_on: "2026-11-08", check_out_on: "2026-11-10" }}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText(i18n.t("rental:check_in_time")), {
    target: { value: "15:00" },
  });
  fireEvent.change(screen.getByLabelText(i18n.t("rental:check_out_time")), {
    target: { value: "11:00" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:wizard_continue") }),
  );
  fireEvent.change(screen.getByLabelText(i18n.t("rental:guest_name")), {
    target: { value: "Guest" },
  });
  fireEvent.change(screen.getByLabelText(i18n.t("rental:guest_contact")), {
    target: { value: "+1 202 555 0123" },
  });
  expect(screen.getByText("Estados Unidos (+1)")).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:wizard_continue") }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:wizard_back") }),
  );
  expect(screen.getByLabelText(i18n.t("rental:guest_contact"))).toHaveValue(
    "2025550123",
  );
  expect(screen.getByText("Estados Unidos (+1)")).toBeInTheDocument();
});
