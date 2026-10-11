import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import MobileRecordCard from "../../../components/MobileRecordCard";
it("preserves zero values and dispatches the existing primary and secondary handlers", async () => {
  const detail = vi.fn(),
    edit = vi.fn();
  render(
    <MobileRecordCard
      title="Synthetic guest"
      fields={[{ key: "balance", label: "Balance", value: 0 }]}
      primaryAction={{ key: "detail", label: "Detail", onClick: detail }}
      actions={[{ key: "edit", label: "Edit", onClick: edit }]}
    />,
  );
  expect(
    screen.getByRole("article", { name: "Synthetic guest" }),
  ).toBeInTheDocument();
  expect(screen.getByText("0")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Detail" }));
  await userEvent.click(
    screen.getByRole("button", { name: /Synthetic guest/ }),
  );
  await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
  expect(detail).toHaveBeenCalledTimes(1);
  expect(edit).toHaveBeenCalledTimes(1);
});
it("disables both action surfaces during a refetch without hiding the information", () => {
  render(
    <MobileRecordCard
      title="Synthetic guest"
      disabled
      fields={[{ key: "nights", label: "Nights", value: 3 }]}
      primaryAction={{ key: "detail", label: "Detail", onClick: vi.fn() }}
      actions={[{ key: "edit", label: "Edit", onClick: vi.fn() }]}
    />,
  );
  expect(screen.getByText("3")).toBeVisible();
  expect(screen.getByRole("button", { name: "Detail" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: /Synthetic guest/ }),
  ).toBeDisabled();
});

it("renders the destructive icon and disables an already-open menu while busy", async () => {
  const remove = vi.fn();
  const props = {
    title: "Synthetic catalog",
    fields: [],
    actions: [
      {
        key: "delete",
        label: "Delete",
        onClick: remove,
        color: "error" as const,
        icon: <DeleteOutlined />,
      },
    ],
  };
  const { rerender } = render(<MobileRecordCard {...props} />);
  await userEvent.click(
    screen.getByRole("button", { name: /Synthetic catalog/ }),
  );
  expect(
    within(screen.getByRole("menuitem", { name: "Delete" })).getByTestId(
      "DeleteOutlinedIcon",
    ),
  ).toBeVisible();
  rerender(<MobileRecordCard {...props} disabled />);
  const option = screen.getByRole("menuitem", { name: "Delete" });
  expect(option).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(option);
  expect(remove).not.toHaveBeenCalled();
});
