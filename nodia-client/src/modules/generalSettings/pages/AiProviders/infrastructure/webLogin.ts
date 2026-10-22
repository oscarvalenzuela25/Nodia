import { z } from "zod";

export const geminiWebLogoutSchema = z.object({ status: z.literal("disconnected") }).strict();

const jobId = z.string().regex(/^[0-9a-f]{32}$/);
export const geminiWebLoginSchema = z.object({ id: jobId, state: z.enum(["running", "succeeded", "failed", "cancelled"]) }).strict();
export const geminiLoginFrameSchema = z.discriminatedUnion("ready", [
  z.object({ ready: z.literal(false), frame_id: z.null(), image: z.null(), width: z.literal(1280), height: z.literal(850) }).strict(),
  z.object({ ready: z.literal(true), frame_id: jobId,
    image: z.string().max(1_048_576).regex(/^\/9j\/[A-Za-z0-9+/]*={0,2}$/).refine((value) => value.length % 4 === 0),
    width: z.literal(1280), height: z.literal(850) }).strict(),
]);
export type GeminiLoginFrame = z.infer<typeof geminiLoginFrameSchema>;
export type GeminiLoginAction =
  | { action: "click"; x: number; y: number }
  | { action: "text"; text: string }
  | { action: "key"; key: string }
  | { action: "scroll"; delta: number };
export type GeminiLoginInput = GeminiLoginAction & { frame_id: string };
