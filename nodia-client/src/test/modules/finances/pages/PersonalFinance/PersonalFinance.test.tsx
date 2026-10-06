import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PersonalFinance from "../../../../../modules/finances/pages/PersonalFinance";
import type { FinanceQuery } from "../../../../../modules/finances/types";
import i18n from "../../../../../translate";

const mocks = vi.hoisted(() => ({ busy: vi.fn() }));
vi.mock("../../../../../modules/finances/infrastructure/useServices", () => ({
  useFinanceBusy: mocks.busy,
}));
vi.mock("../../../../../modules/finances/components/FinanceOverview", () => ({
  default: ({ query }: { query: FinanceQuery }) => (
    <div data-testid="general-panel">{query.active}</div>
  ),
}));
vi.mock(
  "../../../../../modules/finances/components/FinanceResourceTab",
  () => ({
    default: ({
      resource,
      query,
      onQueryChange,
    }: {
      resource: string;
      query: FinanceQuery;
      onQueryChange: (query: FinanceQuery) => void;
    }) => (
      <div data-testid="resource-panel">
        {resource}:{query.active}
        <button onClick={() => onQueryChange({ ...query, active: "inactive" })}>
          Change section filter
        </button>
      </div>
    ),
  }),
);

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

const renderPage = (path = "/finances/personal") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PersonalFinance />
      <Location />
    </MemoryRouter>,
  );
beforeEach(() => mocks.busy.mockReturnValue(false));

describe("PersonalFinance", () => {
  it("starts on General with active records and mounts only the selected panel", () => {
    renderPage();
    expect(screen.getByTestId("general-panel")).toHaveTextContent("active");
    expect(screen.queryByTestId("resource-panel")).not.toBeInTheDocument();
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  });

  it("supports direct links and safely falls back on an invalid tab", () => {
    const view = renderPage("/finances/personal?tab=movements");
    expect(screen.getByTestId("resource-panel")).toHaveTextContent(
      "movements:active",
    );
    expect(screen.queryByTestId("general-panel")).not.toBeInTheDocument();
    view.unmount();
    renderPage("/finances/personal?tab=unknown");
    expect(screen.getByTestId("general-panel")).toBeInTheDocument();
  });

  it("preserves filters separately while unmounting hidden data consumers", async () => {
    renderPage("/finances/personal?tab=movements&other=keep");
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Change section filter" }),
    );
    expect(screen.getByTestId("resource-panel")).toHaveTextContent(
      "movements:inactive",
    );
    await user.click(
      screen.getByRole("tab", { name: i18n.t("finance:tabs.categories") }),
    );
    expect(screen.getByTestId("resource-panel")).toHaveTextContent(
      "categories:active",
    );
    await user.click(
      screen.getByRole("tab", { name: i18n.t("finance:tabs.movements") }),
    );
    expect(screen.getByTestId("resource-panel")).toHaveTextContent(
      "movements:inactive",
    );
    await user.click(
      screen.getByRole("tab", { name: i18n.t("finance:tabs.general") }),
    );
    expect(screen.queryByTestId("resource-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("other=keep");
    expect(screen.getByTestId("location")).not.toHaveTextContent("tab=");
  });

  it("disables navigation during finance requests", () => {
    mocks.busy.mockReturnValue(true);
    renderPage();
    screen.getAllByRole("tab").forEach((tab) => expect(tab).toBeDisabled());
  });
});
