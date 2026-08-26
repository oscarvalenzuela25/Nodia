import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import FilterChips from "../../../../../components/Filter/components/FilterChips";

describe("FilterChips", () => {
  it("should render the label correctly", () => {
    render(<FilterChips label="Test Filter" />);
    expect(screen.getByText("Test Filter")).toBeInTheDocument();
    expect(screen.queryByTestId("filter-chip-action")).not.toBeInTheDocument();
  });

  it("should render action button and call onAction when clicked", async () => {
    const user = userEvent.setup();
    const handleAction = vi.fn();
    render(<FilterChips label="With Action" onAction={handleAction} />);
    
    const actionBtn = screen.getByTestId("filter-chip-action");
    expect(actionBtn).toBeInTheDocument();
    
    await user.click(actionBtn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });
});
