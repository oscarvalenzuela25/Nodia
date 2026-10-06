import type { z } from "zod";
import type * as schemas from "./infrastructure/schemas";
export type RentalProperty = z.infer<typeof schemas.propertySchema>;
export type RentalCollaborator = z.infer<typeof schemas.collaboratorSchema>;
export type RentalPolicy = z.infer<typeof schemas.policySchema>;
export type RentalReservation = z.infer<typeof schemas.reservationSchema>;
export type RentalPayment = z.infer<typeof schemas.paymentSchema>;
export type RentalExpense = z.infer<typeof schemas.expenseSchema>;
export type RentalBlock = z.infer<typeof schemas.blockSchema>;
export type RentalTurnover = z.infer<typeof schemas.turnoverSchema>;
export type RentalAudit = z.infer<typeof schemas.auditSchema>;
export type RentalCandidate = z.infer<typeof schemas.candidateSchema>;
export type RentalTurnoverDetail = z.infer<typeof schemas.turnoverDetailSchema>;
export type RentalCalendar = z.infer<typeof schemas.calendarSchema>;
export type RentalAvailability = z.infer<typeof schemas.availabilitySchema>;
export type RentalOverview = z.infer<typeof schemas.overviewSchema>;
export type RentalRecovery = z.infer<typeof schemas.recoverySchema>;
export type RentalCancellationPreview = z.infer<
  typeof schemas.cancellationPreviewSchema
>;
export type RentalAck = z.infer<typeof schemas.ackSchema>;
export type RentalOperation = RentalAck["operation"];
export type RentalListResource = keyof typeof schemas.rentalRecordSchemas;
export type RentalRecordMap = {
  [R in RentalListResource]: z.infer<(typeof schemas.rentalRecordSchemas)[R]>;
};
export type RentalDetailMap = Omit<RentalRecordMap, "turnovers"> & {
  turnovers: RentalTurnoverDetail;
};
export type RentalPageMeta = z.infer<typeof schemas.pageMetaSchema>;
export type RentalPage<T> = { data: T[]; meta: RentalPageMeta };
export type {
  RentalCommand,
  RentalPayloadMap,
  RentalQuery,
  RentalPreviewInput,
} from "./contracts";
