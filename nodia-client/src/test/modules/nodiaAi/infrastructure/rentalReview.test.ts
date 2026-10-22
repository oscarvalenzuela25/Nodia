import { describe, expect, it } from "vitest";
import { rentalReviewTimezone, rentalTemporalKind, validRentalTemporalDraft } from "../../../../modules/nodiaAi/infrastructure/rentalReview";
import { nodiaAiRentalTool, nodiaAiRentalValueKey } from "../../../../modules/nodiaAi/infrastructure/rentalPresentation";
import { rentalCancellationProposal, rentalCancellationReview, rentalReservationProposal, rentalReservationReview } from "./rentalFixtures";
import { rentalBlockProposal, rentalBlockReview, rentalExpenseProposal, rentalExpenseReview, rentalPreparationProposal, rentalPreparationReview } from "./rentalMoneyPreparationFixtures";

describe("rental proposal temporal boundaries", () => {
  it.each([
    ["rental_payments", ["create", "void"]], ["rental_expenses", ["create", "update", "pay", "void"]],
    ["rental_blocks", ["create", "update"]], ["rental_turnovers", ["update", "approve_same_day"]],
  ])("admits exact %s operations without inventing generic CRUD", (resource, operations) => {
    for (const operation of ["create", "update", "pay", "void", "approve_same_day", "delete", "refund"]) expect(nodiaAiRentalTool(`nodia_${resource}_prepare_${operation}`)).toBe(operations.includes(operation));
  });
  it("uses civil days for expense dates and house-zone instants for blocks and preparation", () => {
    expect(rentalTemporalKind(rentalExpenseProposal, rentalExpenseReview.editable_fields[2])).toBe("date");
    expect(rentalTemporalKind(rentalExpenseProposal, rentalExpenseReview.editable_fields[3])).toBe("date");
    expect(rentalTemporalKind(rentalBlockProposal, rentalBlockReview.editable_fields[0])).toBe("instant");
    expect(rentalTemporalKind(rentalPreparationProposal, rentalPreparationReview.editable_fields[2])).toBe("instant");
    expect(rentalTemporalKind(rentalPreparationProposal, rentalPreparationReview.editable_fields[3])).toBe("instant");
    expect(rentalReviewTimezone(rentalBlockProposal, rentalBlockReview.editable_fields[0])).toBe("America/Santiago");
    expect(nodiaAiRentalValueKey("type", "refund")).toBe("nodiaAi:proposal.rental_values.type.refund");
    expect(nodiaAiRentalValueKey("cleaning_status", "pending")).toBe("nodiaAi:proposal.rental_values.cleaning_status.pending");
    expect(nodiaAiRentalValueKey("notes", "refund")).toBeUndefined();
  });
  it.each(["create", "update", "confirm", "start", "complete", "cancel"])("recognizes only the registered reservation %s tool", operation => {
    expect(nodiaAiRentalTool(`nodia_rental_reservations_prepare_${operation}`)).toBe(true);
    expect(nodiaAiRentalTool(`nodia_rental_properties_prepare_${operation}`)).toBe(["create", "update"].includes(operation));
  });
  it("does not infer rental temporal semantics or enum translation for arbitrary keys", () => {
    const field = rentalCancellationReview.editable_fields[0];
    expect(rentalTemporalKind({ ...rentalCancellationProposal, steps: [{ ...rentalCancellationProposal.steps[0], tool_name: "custom_rental_reservations_prepare_cancel" }] }, field)).toBeNull();
    expect(nodiaAiRentalTool("nodia_rental_reservations_prepare_delete")).toBe(false);
    expect(nodiaAiRentalValueKey("status", "future_state")).toBeUndefined();
    expect(nodiaAiRentalValueKey("notes", "confirmed")).toBeUndefined();
  });
  it("identifies exact civil and instant fields and accepts only authoritative IANA zone", () => {
    expect(rentalTemporalKind(rentalReservationProposal, rentalReservationReview.editable_fields[1])).toBe("date");
    expect(rentalTemporalKind(rentalReservationProposal, rentalReservationReview.editable_fields[3])).toBe("time");
    expect(rentalTemporalKind(rentalCancellationProposal, rentalCancellationReview.editable_fields[0])).toBe("instant");
    const field = rentalCancellationReview.editable_fields[0];
    expect(rentalReviewTimezone(rentalCancellationProposal, field)).toBe("America/Santiago");
    for (const value of ["invalid/zone", null, ""]) expect(rentalReviewTimezone({ ...rentalCancellationProposal, steps: [{ ...rentalCancellationProposal.steps[0], changes: [{ field_key: "timezone", after: value, before: null, before_present: false, after_present: true, origin: "database" }] }] }, field)).toBeNull();
    expect(rentalReviewTimezone({ ...rentalCancellationProposal, steps: [{ ...rentalCancellationProposal.steps[0], changes: [{ field_key: "timezone", after: "America/Santiago", before: null, before_present: false, after_present: true, origin: "user" }] }] }, field)).toBeNull();
  });
  it.each(["2026-02-30", "2026-2-01", "2026-01-01T12:00:00Z", "1899-12-31", ""])("rejects invalid civil day %s", value => expect(validRentalTemporalDraft("date", value)).toBe(false));
  it.each(["24:00", "15:70", "7:00", "15:00Z"])("rejects invalid civil time %s", value => expect(validRentalTemporalDraft("time", value)).toBe(false));
  it.each(["2026-10-17T12:30", "2026-10-17T12:30:00", "2026-02-30T12:30:00Z", "2026-10-17T24:00:00Z"])("rejects ambiguous or invalid instant %s", value => expect(validRentalTemporalDraft("instant", value)).toBe(false));
  it.each(["2026-10-17T12:30:00.000Z", "2026-10-17T09:30:00-03:00"])("accepts explicit UTC/offset without numeric or browser-zone conversion %s", value => expect(validRentalTemporalDraft("instant", value)).toBe(true));
});
