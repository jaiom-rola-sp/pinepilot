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
 * The structured content an LLM must produce for a generation. This is the
 * contract enforced both as the provider's structured-output schema and via
 * server-side re-validation. Kept free of server-owned fields (e.g. usage) so
 * it can be handed directly to a model provider.
 */
export const GenerationContentSchema = z.object({
  title: z.string().describe("Short human-readable name for the script."),
  summary: z
    .string()
    .describe("One or two sentence explanation of what the script does."),
  code: z
    .string()
    .describe(
      "Complete, runnable Pine Script beginning with the version marker.",
    ),
  assumptions: z
    .array(z.string())
    .describe("Assumptions made while generating the script."),
  warnings: z
    .array(z.string())
    .describe("Caveats or risks the user should know before using the script."),
});
export type GenerationContent = z.infer<typeof GenerationContentSchema>;

/**
 * Response body for `POST /v1/generate`.
 * Mirrors the TDD generate response schema: the model content plus server-owned
 * usage metering.
 */
export const GenerateResponseSchema = GenerationContentSchema.extend({
  usage: UsageInfoSchema,
});
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;
