import type { GenerateRequest } from "@pinepilot/shared";

/** Inputs available to a prompt template. */
export type PromptInput = GenerateRequest;

/**
 * A versioned prompt template. Templates are swappable and their `version` is
 * persisted on each generation for analytics and regression tracking.
 */
export interface PromptTemplate {
  readonly version: string;
  buildSystem(input: PromptInput): string;
  buildUser(input: PromptInput): string;
}
