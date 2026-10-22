/** Server-owned registrations only. Empty until a native executor is verified; never provider/model claims. */
export const NODIA_AI_EXECUTION_ADMISSION = Symbol(
  'NODIA_AI_EXECUTION_ADMISSION',
);
export interface NodiaAiExecutionAdmission {
  readonly toolName: string;
  readonly contractHash: string;
  readonly catalogVersion: string;
  readonly bindableFields?: Readonly<Record<string, string>>;
  readonly outputKeys?: Readonly<Record<string, string>>;
}
