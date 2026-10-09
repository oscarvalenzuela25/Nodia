import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import MobileRecordCard from "../../../components/MobileRecordCard";
it("preserves zero values and dispatches the existing primary and secondary handlers", async () => {
  const detail = vi.fn(), edit = vi.fn();
  render(<MobileRecordCard title="Synthetic guest" fields={[{ key: "balance", label: "Balance", value: 0 }]} primaryAction={{ key: "detail", label: "Detail", onClick: detail }} actions={[{ key: "edit", label: "Edit", onClick: edit }]} />);
  expect(screen.getByRole("article", { name: "Synthetic guest" })).toBeInTheDocument();
  expect(screen.getByText("0")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Detail" }));
  await userEvent.click(screen.getByRole("button", { name: /Synthetic guest/ }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
  expect(detail).toHaveBeenCalledTimes(1); expect(edit).toHaveBeenCalledTimes(1);
});
it("disables both action surfaces during a refetch without hiding the information", () => {
  render(<MobileRecordCard title="Synthetic guest" disabled fields={[{ key: "nights", label: "Nights", value: 3 }]} primaryAction={{ key: "detail", label: "Detail", onClick: vi.fn() }} actions={[{ key: "edit", label: "Edit", onClick: vi.fn() }]} />);
  expect(screen.getByText("3")).toBeVisible();
  expect(screen.getByRole("button", { name: "Detail" })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Synthetic guest/ })).toBeDisabled();
});
