import { z } from "zod";
import { PineVersionSchema, TaskTypeSchema } from "./domain.js";

/**
 * Editor context captured from TradingView and sent alongside a prompt.
 * All fields are optional/defaulted so a first-time generation with an empty
 * editor is valid.
 */
export const EditorContextSchema = z.object({
  currentCode: z.string().default(""),
  compilerErrors: z.array(z.string()).default([]),
});
export type EditorContext = z.infer<typeof EditorContextSchema>;

/**
 * Request body for `POST /v1/generate`.
 * Mirrors the TDD generate request schema.
 */
export const GenerateRequestSchema = z.object({
  prompt: z.string().min(1, "prompt is required").max(4000),
  taskType: TaskTypeSchema,
  pineVersion: PineVersionSchema.default("v6"),
  editorContext: EditorContextSchema.default({
    currentCode: "",
    compilerErrors: [],
  }),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/** Usage metering surfaced back to the client after a generation. */
export const UsageInfoSchema = z.object({
  requestsRemaining: z.number().int().nonnegative(),
});
export type UsageInfo = z.infer<typeof UsageInfoSchema>;

/**
 * Response body for `POST /v1/generate`.
 * Mirrors the TDD generate response schema; this is also the structured
 * contract the AI orchestration layer must satisfy before returning to clients.
 */
export const GenerateResponseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  code: z.string(),
  assumptions: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  usage: UsageInfoSchema,
});
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;
