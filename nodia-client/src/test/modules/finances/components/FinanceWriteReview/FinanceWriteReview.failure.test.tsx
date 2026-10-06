import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinanceWriteReview from "../../../../../modules/finances/components/FinanceWriteReview";
import i18n from "../../../../../translate";

describe("FinanceWriteReview", () => {
  it("offers explicit result review for uncertain writes and no automatic retry", async () => {
    const review = vi.fn().mockRejectedValue(new Error("read failed"));
    const { rerender } = render(
      <FinanceWriteReview uncertain busy={false} onReview={review} />,
    );
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: i18n.t("finance:review_result") }),
      );
    expect(review).toHaveBeenCalledTimes(1);
    rerender(<FinanceWriteReview uncertain busy onReview={review} />);
    expect(
      screen.getByRole("button", { name: i18n.t("finance:review_result") }),
    ).toBeDisabled();
  });
});
