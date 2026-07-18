import type { ZodType } from "zod";

export interface LlmGenerateParams {
  system: string;
  user: string;
  /** Zod schema the provider should enforce as structured output. */
  schema: ZodType;
  /** Stable name for the schema (used by structured-output APIs). */
  schemaName: string;
}

export interface LlmResult {
  /**
   * Parsed structured output. Deliberately typed as `unknown`: the provider may
   * claim schema compliance, but the caller MUST re-validate server-side.
   */
  content: unknown;
  /** Total tokens consumed, for lightweight analytics (0 if unknown). */
  tokensUsed: number;
}

/**
 * Provider boundary for LLM generation. Route/service code depends only on this
 * interface so additional providers (e.g. Anthropic) can be added without
 * touching callers.
 */
export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  generateStructured(params: LlmGenerateParams): Promise<LlmResult>;
}

/** Raised when the provider itself fails (transport, refusal, empty output). */
export class LlmProviderError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "LlmProviderError";
  }
}
