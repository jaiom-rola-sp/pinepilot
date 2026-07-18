import { describe, expect, it, vi } from "vitest";
import { GenerationContentSchema } from "@pinepilot/shared";
import {
  OpenAiProvider,
  type OpenAiChatClient,
  type OpenAiChatCompletion,
} from "../src/generation/openai-provider.js";
import { LlmProviderError } from "../src/generation/llm-provider.js";

function makeClient(impl: () => Promise<OpenAiChatCompletion>): {
  client: OpenAiChatClient;
  create: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn(impl);
  return {
    client: { chat: { completions: { create } } },
    create,
  };
}

const params = {
  system: "system",
  user: "user",
  schema: GenerationContentSchema,
  schemaName: "pine_generation",
};

const validContent = {
  title: "t",
  summary: "s",
  code: "//@version=6",
  assumptions: [],
  warnings: [],
};

describe("OpenAiProvider.generateStructured", () => {
  it("sends a strict json_schema response_format and returns parsed content", async () => {
    const { client, create } = makeClient(async () => ({
      choices: [{ message: { content: JSON.stringify(validContent) } }],
      usage: { total_tokens: 42 },
    }));
    const provider = new OpenAiProvider({
      apiKey: "k",
      model: "gpt-4o-2024-08-06",
      client,
    });

    const result = await provider.generateStructured(params);

    expect(result.content).toEqual(validContent);
    expect(result.tokensUsed).toBe(42);

    const callArg = create.mock.calls[0]![0] as {
      model: string;
      response_format: { type: string; json_schema: { strict: boolean } };
    };
    expect(callArg.model).toBe("gpt-4o-2024-08-06");
    expect(callArg.response_format.type).toBe("json_schema");
    expect(callArg.response_format.json_schema.strict).toBe(true);
  });

  it("throws LlmProviderError on a model refusal", async () => {
    const { client } = makeClient(async () => ({
      choices: [{ message: { refusal: "cannot help" } }],
    }));
    const provider = new OpenAiProvider({ apiKey: "k", model: "m", client });
    await expect(provider.generateStructured(params)).rejects.toBeInstanceOf(
      LlmProviderError,
    );
  });

  it("throws LlmProviderError on empty content", async () => {
    const { client } = makeClient(async () => ({
      choices: [{ message: { content: "" } }],
    }));
    const provider = new OpenAiProvider({ apiKey: "k", model: "m", client });
    await expect(provider.generateStructured(params)).rejects.toBeInstanceOf(
      LlmProviderError,
    );
  });

  it("throws LlmProviderError on non-JSON content", async () => {
    const { client } = makeClient(async () => ({
      choices: [{ message: { content: "not json" } }],
    }));
    const provider = new OpenAiProvider({ apiKey: "k", model: "m", client });
    await expect(provider.generateStructured(params)).rejects.toBeInstanceOf(
      LlmProviderError,
    );
  });

  it("wraps transport errors as LlmProviderError", async () => {
    const { client } = makeClient(async () => {
      throw new Error("network down");
    });
    const provider = new OpenAiProvider({ apiKey: "k", model: "m", client });
    await expect(provider.generateStructured(params)).rejects.toBeInstanceOf(
      LlmProviderError,
    );
  });
});
