import { ui, resetUI, renderRoute } from "../../components/fixtures";
import { beforeEach, expect, it } from "vitest";
import { screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import RentalReservations from "../../../../../modules/rentals/pages/RentalReservations";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("rejects invalid property IDs before enabling dependent views", () => {
  renderRoute(
    <RentalReservations />,
    "/tools/reservations?property=1e2&tab=payments",
  );
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.getByText(i18n.t("rental:invalid_input"))).toBeInTheDocument();
});
it("protects navigation while an operation is unresolved", async () => {
  ui.uncertain = true;
  const { router } = renderRoute(<RentalReservations />);
  await act(async () => {
    await router.navigate("/elsewhere");
  });
  expect(screen.queryByText("Elsewhere")).not.toBeInTheDocument();
  expect(
    screen.getAllByText(i18n.t("rental:pending_navigation")).length,
  ).toBeGreaterThan(0);
});
it("preserves an edited form through a temporary house read failure and recovery", async () => {
  const { router } = renderRoute(
    <RentalReservations />,
    "/tools/reservations?property=1&tab=reservations",
  );
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:create") }),
  );
  fireEvent.change(screen.getByLabelText(i18n.t("rental:guest_name")), {
    target: { value: "Unsaved synthetic guest" },
  });
  ui.accessError = true;
  await act(async () => {
    await router.navigate("?property=1&tab=reservations&check=1");
  });
  expect(screen.getByLabelText(i18n.t("rental:guest_name"))).toHaveValue(
    "Unsaved synthetic guest",
  );
  expect(
    screen.getByRole("button", { name: i18n.t("rental:save") }),
  ).toBeEnabled();
  screen
    .getAllByRole("button", { name: i18n.t("rental:close") })
    .forEach((button) => expect(button).toBeEnabled());
  ui.accessError = false;
  await act(async () => {
    await router.navigate("?property=1&tab=reservations&check=2");
  });
  expect(screen.getByLabelText(i18n.t("rental:guest_name"))).toHaveValue(
    "Unsaved synthetic guest",
  );
});
it("allows a house access recheck while a write remains uncertain", async () => {
  ui.uncertain = true;
  ui.busy = true;
  ui.accessError = true;
  renderRoute(<RentalReservations />);
  const retry = screen.getByRole("button", { name: i18n.t("rental:retry") });
  expect(retry).toBeEnabled();
  await userEvent.click(retry);
  expect(ui.propertyRefetch).toHaveBeenCalledOnce();
});
it("removes the workspace after a definitive house access rejection without a pending write", () => {
  ui.accessError = true;
  ui.accessCause = new AxiosError("revoked", undefined, undefined, undefined, {
    status: 404,
    statusText: "Not Found",
    headers: {},
    data: {},
    config: { headers: new AxiosHeaders() },
  });
  renderRoute(<RentalReservations />);
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
});
