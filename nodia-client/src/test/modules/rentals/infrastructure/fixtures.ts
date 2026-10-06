import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  propertySchema,
  reservationSchema,
  turnoverDetailSchema,
  paymentSchema,
  expenseSchema,
  overviewSchema,
  calendarSchema,
  availabilitySchema,
} from "../../../../modules/rentals/infrastructure/schemas";
export const examples = z
  .array(
    z.object({
      route: z.string(),
      method: z.string(),
      url: z.string(),
      status: z.number(),
      request: z.unknown().optional(),
      response: z.unknown(),
    }),
  )
  .parse(
    JSON.parse(
      readFileSync("../nodia-server/test/fixtures/rental/api.json", "utf8"),
    ),
  );
export function example(suffix: string) {
  const value = examples.find(
    (row) => row.route === `GET /api/v1/rental/properties${suffix}`,
  );
  if (!value) throw new Error(`Missing synthetic fixture ${suffix}`);
  return value.response;
}
export const property = propertySchema.parse(example("/{propertyId}"));
export const reservation = reservationSchema.parse(
  example("/{propertyId}/reservations/{id}"),
);
export const turnover = turnoverDetailSchema.parse(
  example("/{propertyId}/turnovers/{id}"),
);
export const payment = paymentSchema.parse(
  example("/{propertyId}/payments/{id}"),
);
export const expense = expenseSchema.parse(
  example("/{propertyId}/expenses/{id}"),
);
export const overview = overviewSchema.parse(example("/{propertyId}/overview"));
export const calendar = calendarSchema.parse(example("/{propertyId}/calendar"));
export const availability = availabilitySchema.parse(
  example("/{propertyId}/availability"),
);
