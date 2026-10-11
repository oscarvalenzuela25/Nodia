import {
  ui,
  property,
  reservation,
  resetUI,
  renderRoute,
  result,
  page,
} from "../fixtures";
import { beforeEach, expect, it } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RentalWorkspace from "../../../../../modules/rentals/components/RentalWorkspace";
import i18n from "../../../../../translate";
import { example } from "../../infrastructure/fixtures";
import { blockSchema } from "../../../../../modules/rentals/infrastructure/schemas";
beforeEach(resetUI);
it("mounts only the visible tab and ignores an invalid tab query", async () => {
  const { router } = renderRoute(
    <RentalWorkspace property={property} />,
    "/tools/reservations?tab=invalid&property=1",
  );
  expect(
    screen.getByRole("tab", { name: i18n.t("rental:tabs.calendar") }),
  ).toHaveAttribute("aria-selected", "true");
  expect(ui.list).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("tab", { name: i18n.t("rental:tabs.turnovers") }),
  );
  expect(router.state.location.search).toContain("tab=turnovers");
  expect(ui.list).toHaveBeenCalledWith("turnovers", property.id, {
    page: 1,
    limit: 10,
  });
  expect(ui.list.mock.calls.some(([resource]) => resource === "expenses")).toBe(
    false,
  );
});
it.each(["collaborators", "configuration"] as const)(
  "keeps %s in the primary tabs and loads it only on selection",
  async (tab) => {
    const { router } = renderRoute(
      <RentalWorkspace property={property} />,
      "/tools/reservations?property=1",
    );
    const tabName = i18n.t(`rental:tabs.${tab}`);
    const calendarName = i18n.t("rental:tabs.calendar");
    expect(screen.getByRole("tab", { name: tabName })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tab", { name: calendarName })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(ui.list).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("tab", { name: tabName }));
    expect(router.state.location.search).toContain(`tab=${tab}`);
    expect(router.state.location.search).toContain("property=1");
    expect(screen.getByRole("tab", { name: tabName })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      `rental-tab-${tab}`,
    );
    expect(ui.list).toHaveBeenCalledWith(
      tab === "collaborators" ? "collaborators" : "cancellation-policies",
      property.id,
      {
        page: 1,
        limit: 10,
        active: "active",
      },
    );
    await userEvent.click(screen.getByRole("tab", { name: calendarName }));
    expect(screen.getAllByRole("tab", { name: tabName })).toHaveLength(1);
    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("rental:calendar_manage") }),
    );
    expect(
      screen.queryByRole("menuitem", { name: tabName }),
    ).not.toBeInTheDocument();
  },
);
it.each(["reservations", "blocks"] as const)(
  "preserves the %s editor through a failed detail revalidation",
  async (resource) => {
    const row =
      resource === "reservations"
        ? reservation
        : blockSchema.parse(example("/{propertyId}/blocks/{id}"));
    let failed = false;
    let cleared = false;
    ui.list.mockImplementation((kind: string) =>
      kind === resource ? page([row]) : page([]),
    );
    ui.record.mockImplementation(
      (kind: string, _property: string, id?: string) => ({
        ...result(kind === resource && id && !cleared ? row : undefined),
        isError: kind === resource && !!id && failed,
      }),
    );
    const url = `/tools/reservations?property=1&tab=${resource === "reservations" ? "reservations" : "calendar"}`;
    const { router } = renderRoute(
      <RentalWorkspace property={property} />,
      url,
    );
    if (resource === "blocks")
      await userEvent.click(
        screen.getByRole("button", { name: i18n.t("rental:manage_blocks") }),
      );
    await userEvent.click(
      screen.getByRole("button", {
        name: i18n.t("rental:row_actions", { id: row.id }),
      }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: i18n.t("rental:edit") }),
    );
    fireEvent.change(screen.getByLabelText(i18n.t("rental:notes")), {
      target: { value: "Preserve this edit" },
    });
    failed = true;
    await act(async () => {
      await router.navigate(`${url}&check=1`);
    });
    expect(screen.getByLabelText(i18n.t("rental:notes"))).toHaveValue(
      "Preserve this edit",
    );
    cleared = true;
    ui.uncertain = true;
    await act(async () => {
      await router.navigate(`${url}&check=3`);
    });
    expect(screen.getByLabelText(i18n.t("rental:notes"))).toHaveValue(
      "Preserve this edit",
    );
    expect(
      screen.getByRole("button", { name: i18n.t("rental:recover") }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    ).toBeDisabled();
    failed = false;
    await act(async () => {
      await router.navigate(`${url}&check=2`);
    });
    expect(screen.getByLabelText(i18n.t("rental:notes"))).toHaveValue(
      "Preserve this edit",
    );
  },
);
