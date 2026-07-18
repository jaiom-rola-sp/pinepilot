import type { GenerateRequest } from "@pinepilot/shared";
import { pineTemplateV1 } from "./prompts/pine-v1.js";
import type { PromptTemplate } from "./prompts/types.js";

export interface BuiltPrompt {
  system: string;
  user: string;
  promptVersion: string;
}

/**
 * Selects and applies the active prompt template. Centralizes all prompt text
 * so route/service code never hardcodes prompting and templates stay swappable.
 */
export class PromptBuilder {
  constructor(private readonly template: PromptTemplate = pineTemplateV1) {}

  build(request: GenerateRequest): BuiltPrompt {
    return {
      system: this.template.buildSystem(request),
      user: this.template.buildUser(request),
      promptVersion: this.template.version,
    };
  }
}
