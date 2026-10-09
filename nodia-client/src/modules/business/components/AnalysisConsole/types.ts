import { z } from "zod";
export const serverStages = ['reserved', 'request_received', 'file_validated', 'connection_resolved', 'session_checked', 'model_checked', 'provider_request_started', 'cli_initialized', 'document_read_started', 'document_read_completed', 'turn_started', 'response_receiving', 'response_received', 'extraction_validated', 'observation_unavailable', 'failed', 'cancelled'] as const;
export const snapshotSchema = z.object({
  version: z.literal(1), id: z.uuid(), state: z.enum(['reserved', 'running', 'succeeded', 'failed', 'cancelled']),
  identity: z.object({ providerId: z.string().max(128).nullable(), provider: z.string().max(128), mode: z.string().max(32).nullable(), model: z.string().max(128).nullable() }).nullable(),
  events: z.array(z.object({ version: z.literal(1), sequence: z.number().int().positive(), occurredAt: z.iso.datetime({ offset: true }),
    stage: z.enum(serverStages), severity: z.enum(['info', 'warning', 'error']) })).max(256),
  lastSequence: z.number().int().nonnegative(), gap: z.boolean(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type LocalStage = 'upload_started' | 'upload_completed' | 'history_loading' | 'history_unavailable' | 'rows_preparing' | 'draft_ready';
export type ConsoleEvent = { key: string; occurredAt: string; stage: typeof serverStages[number] | LocalStage; severity: 'info' | 'warning' | 'error' };
export type ConsolePhase = 'idle' | 'reserving' | 'analyzing' | 'preparing' | 'ready' | 'failed' | 'uncertain' | 'cancelled';
export type ConsoleView = { phase: ConsolePhase; startedAt: number | null; events: ConsoleEvent[]; identity: Snapshot['identity'];
  observationError: boolean; gap: boolean; uploadPercent: number | null; correlation: string | null; isFetching: boolean; resume: () => void };

