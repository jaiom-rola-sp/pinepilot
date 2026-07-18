import type { PrismaClient } from "@prisma/client";
import {
  GenerateResponseSchema,
  GenerationContentSchema,
  type GenerateRequest,
  type GenerateResponse,
  type GenerationContent,
} from "@pinepilot/shared";
import type { LlmProvider } from "./llm-provider.js";
import { LlmProviderError } from "./llm-provider.js";
import { PromptBuilder } from "./prompt-builder.js";
import { BadGatewayError, UnprocessableEntityError } from "../http-errors.js";

const SCHEMA_NAME = "pine_generation";

/**
 * Placeholder until usage metering (milestone B2). Not real accounting — the
 * contract requires a non-negative integer here.
 */
const PLACEHOLDER_REQUESTS_REMAINING = 0;

export interface GenerationServiceDeps {
  prisma: PrismaClient;
  provider: LlmProvider;
  promptBuilder?: PromptBuilder;
  /** Extra attempts on schema/guardrail failure (0 = single attempt). */
  maxRetries?: number;
}

export interface GenerateInput {
  userId: string;
  request: GenerateRequest;
}

/** Require the correct Pine version marker (defense-in-depth guardrail). */
function hasPineVersionMarker(code: string, pineVersion: string): boolean {
  const version = pineVersion.replace(/^v/, "");
  return new RegExp(`//@version\\s*=\\s*${version}\\b`).test(code);
}

export class GenerationService {
  private readonly prisma: PrismaClient;
  private readonly provider: LlmProvider;
  private readonly promptBuilder: PromptBuilder;
  private readonly maxRetries: number;

  constructor(deps: GenerationServiceDeps) {
    this.prisma = deps.prisma;
    this.provider = deps.provider;
    this.promptBuilder = deps.promptBuilder ?? new PromptBuilder();
    this.maxRetries = deps.maxRetries ?? 1;
  }

  async generate(input: GenerateInput): Promise<GenerateResponse> {
    const { request, userId } = input;
    const prompt = this.promptBuilder.build(request);

    let lastIssue = "unknown validation error";
    let tokensUsed = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      let raw: unknown;
      try {
        const result = await this.provider.generateStructured({
          system: prompt.system,
          user: prompt.user,
          schema: GenerationContentSchema,
          schemaName: SCHEMA_NAME,
        });
        raw = result.content;
        tokensUsed = result.tokensUsed;
      } catch (err) {
        // Provider/transport failures are not retried; surface as 502.
        if (err instanceof LlmProviderError) {
          throw new BadGatewayError("Generation provider failed");
        }
        throw err;
      }

      const parsed = GenerationContentSchema.safeParse(raw);
      if (!parsed.success) {
        lastIssue = parsed.error.issues
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ");
        continue;
      }

      if (!hasPineVersionMarker(parsed.data.code, request.pineVersion)) {
        lastIssue = `missing Pine ${request.pineVersion} version marker`;
        continue;
      }

      const content = parsed.data;
      await this.persist({
        userId,
        request,
        content,
        tokensUsed,
        promptVersion: prompt.promptVersion,
      });

      // Final server-side validation against the public API contract.
      return GenerateResponseSchema.parse({
        ...content,
        usage: { requestsRemaining: PLACEHOLDER_REQUESTS_REMAINING },
      });
    }

    throw new UnprocessableEntityError(
      `Model output failed validation after ${this.maxRetries + 1} attempt(s): ${lastIssue}`,
    );
  }

  private async persist(args: {
    userId: string;
    request: GenerateRequest;
    content: GenerationContent;
    tokensUsed: number;
    promptVersion: string;
  }): Promise<void> {
    await this.prisma.generation.create({
      data: {
        userId: args.userId,
        prompt: args.request.prompt,
        taskType: args.request.taskType,
        pineVersion: args.request.pineVersion,
        outputTitle: args.content.title,
        outputCode: args.content.code,
        outputSummary: args.content.summary,
        tokenCost: args.tokensUsed,
        provider: this.provider.name,
        model: this.provider.model,
        promptVersion: args.promptVersion,
      },
    });
  }
}
