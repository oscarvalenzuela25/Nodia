import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserScopeSelect from "../../../components/UserScopeSelect";
import i18n from "../../../translate";

const state = vi.hoisted(() => ({
  loading: false,
  failed: false,
  refetch: vi.fn(),
  onChange: vi.fn(),
}));
vi.mock(
  "../../../components/UserScopeSelect/infrastructure/useServices",
  () => ({
    useScopeUsers: () => ({
      list: {
        data: {
          pages: [
            {
              data: [
                { id: "1", name: "Owner one", email: "one@example.invalid" },
                { id: "2", name: "Owner two", email: "two@example.invalid" },
              ],
            },
          ],
        },
        isError: state.failed,
        isFetching: state.loading,
        refetch: state.refetch,
        hasNextPage: false,
      },
      selected: {
        data: {
          data: [{ id: "1", name: "Owner one", email: "one@example.invalid" }],
        },
        isError: false,
        isFetching: false,
        refetch: state.refetch,
      },
    }),
  }),
);
beforeEach(async () => {
  vi.clearAllMocks();
  state.loading = false;
  state.failed = false;
  await i18n.changeLanguage("es");
});
describe("UserScopeSelect", () => {
  it("retains the selected identity and emits the explicitly chosen user", async () => {
    render(<UserScopeSelect value="1" onChange={state.onChange} />);
    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("core:data_owner") }),
    );
    await userEvent.click(
      screen.getByRole("option", { name: "Owner two (two@example.invalid)" }),
    );
    expect(state.onChange).toHaveBeenCalledWith("2");
  });
  it("disables changes during requests and when the surrounding editor is locked", () => {
    state.loading = true;
    const view = render(
      <UserScopeSelect value="1" onChange={state.onChange} />,
    );
    expect(
      screen.getByRole("button", { name: i18n.t("core:data_owner") }),
    ).toHaveAttribute("aria-disabled", "true");
    state.loading = false;
    view.rerender(
      <UserScopeSelect value="1" onChange={state.onChange} disabled />,
    );
    expect(
      screen.getByRole("button", { name: i18n.t("core:data_owner") }),
    ).toHaveAttribute("aria-disabled", "true");
  });
  it("offers retry without discarding the selected user after a request failure", async () => {
    state.failed = true;
    render(<UserScopeSelect value="1" onChange={state.onChange} />);
    expect(
      screen.getByText("Owner one (one@example.invalid)"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("core:retry") }),
    );
    expect(state.refetch).toHaveBeenCalledTimes(2);
    expect(state.onChange).not.toHaveBeenCalled();
  });
});
