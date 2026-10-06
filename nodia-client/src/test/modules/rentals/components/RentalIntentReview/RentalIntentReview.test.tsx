import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RentalIntentReview from "../../../../../modules/rentals/components/RentalIntentReview";
import type { RentalMutation } from "../../../../../modules/rentals/infrastructure/useServices";
import i18n from "../../../../../translate";
import { paymentAck } from "../fixtures";
beforeEach(() => vi.clearAllMocks());
it("reports resolution only after a verified acknowledgement", async () => {
  const resolved = vi.fn(),
    recover = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(paymentAck);
  const mutation = {
    isUncertain: true,
    isPending: false,
    recover,
    retry: vi.fn(),
  } as unknown as RentalMutation;
  render(<RentalIntentReview mutation={mutation} onResolved={resolved} />);
  const button = screen.getByRole("button", { name: i18n.t("rental:recover") });
  await userEvent.click(button);
  expect(resolved).not.toHaveBeenCalled();
  await userEvent.click(button);
  expect(resolved).toHaveBeenCalledWith(paymentAck);
});
