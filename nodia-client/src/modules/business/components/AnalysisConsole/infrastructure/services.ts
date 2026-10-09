import { z } from "zod";
import { mainInstance } from "../../../../../config/api";
import { apiPath } from "../../../../../config/apiPath";
import type { AnalyzeInvoiceParams } from "../../../infrastructure/types";
import { snapshotSchema } from "../types";
export type RequestedContext = Omit<AnalyzeInvoiceParams, 'file' | 'analysisId' | 'signal' | 'onUploadProgress'>;
export async function reserveObservation(context: RequestedContext, signal: AbortSignal) {
  const { data } = await mainInstance.post(apiPath("/invoices/analysis-observations"), context, { signal });
  return z.object({ version: z.literal(1), id: z.uuid() }).parse(data);
}
export async function readObservation(id: string, after: number, signal: AbortSignal) {
  const { data } = await mainInstance.get(apiPath(`/invoices/analysis-observations/${id}`), { params: { after }, signal });
  const snapshot = snapshotSchema.parse(data);
  if (snapshot.id !== id || snapshot.lastSequence < after ||
      snapshot.events.some((event, index) => event.sequence <= (index ? snapshot.events[index - 1].sequence : after) || event.sequence > snapshot.lastSequence)) {
    throw new Error("Invalid observation sequence");
  }
  return snapshot;
}

