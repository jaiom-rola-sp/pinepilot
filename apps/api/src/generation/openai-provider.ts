import { zodResponseFormat } from "openai/helpers/zod";
import type {
  LlmGenerateParams,
  LlmProvider,
  LlmResult,
} from "./llm-provider.js";
import { LlmProviderError } from "./llm-provider.js";

/**
 * Minimal shape of the OpenAI chat completions API we depend on. Declared
 * locally so the concrete client can be injected in tests without the SDK.
 */
export interface OpenAiChatClient {
  chat: {
    completions: {
      create(params: unknown): Promise<OpenAiChatCompletion>;
    };
  };
}

export interface OpenAiChatCompletion {
  choices: Array<{
    message?: {
      content?: string | null;
      refusal?: string | null;
    };
  }>;
  usage?: { total_tokens?: number } | null;
}

export interface OpenAiProviderOptions {
  apiKey: string;
  model: string;
  client?: OpenAiChatClient;
}

/**
 * OpenAI provider using strict Structured Outputs (`response_format` of type
 * `json_schema` with `strict: true`, generated from our Zod schema). This makes
 * the model conform to the schema at decode time; the service still re-validates.
 */
export class OpenAiProvider implements LlmProvider {
  public readonly name = "openai";
  public readonly model: string;
  private readonly clientPromise: Promise<OpenAiChatClient>;

  constructor(options: OpenAiProviderOptions) {
    this.model = options.model;
    this.clientPromise = options.client
      ? Promise.resolve(options.client)
      : // Lazy import so tests that inject a client never load the SDK.
        import("openai").then(
          (mod) => new mod.default({ apiKey: options.apiKey }),
        );
  }

  async generateStructured(params: LlmGenerateParams): Promise<LlmResult> {
    const client = await this.clientPromise;

    let completion: OpenAiChatCompletion;
    try {
      completion = await client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
        response_format: zodResponseFormat(params.schema, params.schemaName),
      });
    } catch (err) {
      throw new LlmProviderError("OpenAI request failed", err);
    }

    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      throw new LlmProviderError(`Model refused: ${message.refusal}`);
    }

    const content = message?.content;
    if (!content) {
      throw new LlmProviderError("OpenAI returned empty content");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new LlmProviderError("OpenAI returned non-JSON content", err);
    }

    return { content: parsed, tokensUsed: completion.usage?.total_tokens ?? 0 };
  }
}
