import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import FinanceWriteReview from "../../../../../modules/finances/components/FinanceWriteReview";
describe("FinanceWriteReview", () => {
  it("appears only for uncertain writes and disables review while reading", async () => {
    const review = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <FinanceWriteReview uncertain={false} busy={false} onReview={review} />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    view.rerender(<FinanceWriteReview uncertain busy onReview={review} />);
    expect(
      screen.getByRole("button", { name: "Revisar resultado" }),
    ).toBeDisabled();
    view.rerender(
      <FinanceWriteReview uncertain busy={false} onReview={review} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Revisar resultado" }),
    );
    expect(review).toHaveBeenCalledOnce();
  });
  it("handles review failure without dismissing the warning", async () => {
    const review = vi.fn().mockRejectedValue(new Error("Read failed"));
    render(<FinanceWriteReview uncertain busy={false} onReview={review} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Revisar resultado" }),
    );
    expect(review).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
