import { ui, property, reservation, resetUI } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReservationModal from "../../../../../modules/rentals/components/ReservationModal";
import { formatRentalAmount } from "../../../../../modules/rentals/utils/money";
import i18n from "../../../../../translate";

const contactInput = () =>
  screen.getByRole("textbox", { name: i18n.t("rental:guest_contact") });

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
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:wizard_continue") }),
  );
  const arrival = screen.getByLabelText(i18n.t("rental:check_in_time"));
  expect(arrival).toHaveAttribute("aria-required", "true");
  await waitFor(() => expect(arrival).toHaveFocus());
  expect(arrival).toHaveAccessibleDescription(i18n.t("rental:invalid_local_time"));
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
  const progress = screen.getByRole("list", { name: i18n.t("rental:wizard_progress") });
  const guestStep = within(progress).getAllByRole("listitem")[1];
  expect(guestStep).toHaveAttribute("aria-current", "step");
  expect(guestStep).toHaveFocus();
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
  const contact = contactInput();
  expect(contact).toHaveAttribute("aria-required", "true");
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:wizard_continue") }),
  );
  await waitFor(() => expect(contact).toHaveFocus());
  expect(ui.execute).not.toHaveBeenCalled();
});

it("reviews the stay and guest, keeps terms when revisiting the guest, and applies only the Airbnb rate suggestion", async () => {
  const user = userEvent.setup();
  ui.execute.mockRejectedValueOnce(new Error("known rejection"));
  render(
    <ReservationModal
      property={{
        ...property,
        default_nightly_rate: "80000",
        default_deposit_percent: "25",
        default_cancellation_policy_id: "1",
      }}
      open
      initialStay={{ check_in_on: "2026-11-08", check_out_on: "2026-11-10" }}
      onClose={vi.fn()}
    />,
  );
  const continueStep = () =>
    user.click(screen.getByRole("button", { name: i18n.t("rental:wizard_continue") }));
  const change = (name: string, value: string) =>
    fireEvent.change(screen.getByLabelText(i18n.t(name)), { target: { value } });
  change("rental:check_in_time", "15:00");
  change("rental:check_out_time", "11:00");
  await continueStep();
  change("rental:guest_name", "Synthetic guest");
  fireEvent.change(contactInput(), { target: { value: "guest@example.test" } });
  await user.click(screen.getByRole("button", { name: i18n.t("rental:channel") }));
  await user.click(screen.getByText(i18n.t("rental:channel_airbnb")));
  await continueStep();

  const review = screen.getByRole("region", { name: i18n.t("rental:wizard_review") });
  expect(within(review).getByText(/15:00/)).toHaveAttribute("datetime", "2026-11-08T15:00");
  expect(within(review).getByText(/11:00/)).toHaveAttribute("datetime", "2026-11-10T11:00");
  const save = () => user.click(
    screen.getByRole("button", { name: i18n.t("rental:wizard_draft") }),
  );
  await save();
  const rate = screen.getByLabelText(i18n.t("rental:nightly_rate"));
  await waitFor(() => expect(rate).toHaveFocus());
  expect(ui.execute).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: i18n.t("rental:apply_house_suggestions") }),
  );
  expect(rate).toHaveValue("80000");
  expect(screen.getByLabelText(i18n.t("rental:deposit_amount"))).toHaveValue("0");
  expect(screen.getByLabelText(i18n.t("rental:cancellation_policy"))).toHaveValue("");
  expect(screen.getByText(formatRentalAmount("160000", i18n.language))).toBeInTheDocument();

  await user.click(within(review).getByRole("button", { name: i18n.t("rental:wizard_edit_guest") }));
  change("rental:guest_name", "Updated synthetic guest");
  await continueStep();
  expect(screen.getByLabelText(i18n.t("rental:nightly_rate"))).toHaveValue("80000");
  await save();
  expect(ui.execute).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      operation: "reservation.create",
      data: expect.objectContaining({
        guest_name: "Updated synthetic guest",
        channel: "airbnb",
        nightly_rate: "80000",
        deposit_amount: "0",
        cancellation_policy_id: null,
      }),
    }),
  );
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

it("brings recovery into focus after an uncertain save without modifying the draft", async () => {
  const close = vi.fn();
  const view = render(
    <ReservationModal
      property={property}
      open
      initialData={reservation}
      onClose={close}
    />,
  );
  const note = screen.getByLabelText(i18n.t("rental:notes"));
  fireEvent.change(note, { target: { value: "Preserved note" } });
  ui.uncertain = true;
  view.rerender(
    <ReservationModal
      property={property}
      open
      initialData={reservation}
      onClose={close}
    />,
  );
  const recover = screen.getByRole("button", { name: i18n.t("rental:recover") });
  expect(recover.closest('[tabindex="-1"]')).toHaveFocus();
  expect(note).toHaveValue("Preserved note");
  expect(screen.getByRole("button", { name: i18n.t("rental:save") })).toBeDisabled();
  expect(close).not.toHaveBeenCalled();
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
  expect(contactInput()).toHaveValue(
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
  fireEvent.change(contactInput(), {
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
  expect(contactInput()).toHaveValue(
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
  const input = contactInput();
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
  fireEvent.change(contactInput(), {
    target: { value: "+1 202 555 0123" },
  });
  expect(screen.getByText("Estados Unidos (+1)")).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:wizard_continue") }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:wizard_back") }),
  );
  expect(contactInput()).toHaveValue(
    "2025550123",
  );
  expect(screen.getByText("Estados Unidos (+1)")).toBeInTheDocument();
});
