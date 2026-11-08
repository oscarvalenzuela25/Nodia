export const MEASUREMENT_UNITS = ["unit", "kg", "g", "bundle"] as const;
export type MeasurementUnit = typeof MEASUREMENT_UNITS[number];
export const isMeasurementUnit = (value: unknown): value is MeasurementUnit =>
  typeof value === "string" && MEASUREMENT_UNITS.some((unit) => unit === value);

/** Omission represents the existing default; invalid values never do. */
export const measurementUnit = (value: unknown): MeasurementUnit => {
  if (value === undefined) return "unit";
  if (!isMeasurementUnit(value)) throw new Error("invalid_measurement_unit");
  return value;
};
