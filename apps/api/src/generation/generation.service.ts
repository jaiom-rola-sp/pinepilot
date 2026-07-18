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
import type { QuotaSnapshot, UsageService } from "./usage.service.js";
import {
  BadGatewayError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "../http-errors.js";

const SCHEMA_NAME = "pine_generation";

export interface GenerationServiceDeps {
  prisma: PrismaClient;
  provider: LlmProvider;
  usageService: UsageService;
  promptBuilder?: PromptBuilder;
  /** Extra attempts on schema/guardrail failure (0 = single attempt). */
  maxRetries?: number;
}

export interface GenerateInput {
  userId: string;
  request: GenerateRequest;
}

/** Generation result plus the quota snapshot after consumption. */
export interface GenerateOutput {
  result: GenerateResponse;
  quota: QuotaSnapshot;
}

/** Require the correct Pine version marker (defense-in-depth guardrail). */
function hasPineVersionMarker(code: string, pineVersion: string): boolean {
  const version = pineVersion.replace(/^v/, "");
  return new RegExp(`//@version\\s*=\\s*${version}\\b`).test(code);
}

export class GenerationService {
  private readonly prisma: PrismaClient;
  private readonly provider: LlmProvider;
  private readonly usageService: UsageService;
  private readonly promptBuilder: PromptBuilder;
  private readonly maxRetries: number;

  constructor(deps: GenerationServiceDeps) {
    this.prisma = deps.prisma;
    this.provider = deps.provider;
    this.usageService = deps.usageService;
    this.promptBuilder = deps.promptBuilder ?? new PromptBuilder();
    this.maxRetries = deps.maxRetries ?? 1;
  }

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const { request, userId } = input;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    if (!user) {
      throw new UnauthorizedError("Unknown user");
    }

    // Enforce quota BEFORE any provider work. `reserve` atomically consumes one
    // credit and throws 429 (pre-provider) when the plan limit is exhausted.
    const quota = await this.usageService.reserve(userId, user.plan);

    try {
      const result = await this.runGeneration(userId, request, quota);
      return { result, quota };
    } catch (err) {
      // Do not charge for failed generations (provider/validation errors).
      await this.usageService.release(userId, user.plan);
      throw err;
    }
  }

  private async runGeneration(
    userId: string,
    request: GenerateRequest,
    quota: QuotaSnapshot,
  ): Promise<GenerateResponse> {
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
        usage: { requestsRemaining: quota.remaining },
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
