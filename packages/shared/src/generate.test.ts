import { describe, expect, it } from "vitest";
import { GenerateRequestSchema, GenerateResponseSchema } from "./generate.js";

describe("GenerateRequestSchema", () => {
  it("parses a minimal valid request and applies defaults", () => {
    const result = GenerateRequestSchema.parse({
      prompt: "Build an RSI strategy with ATR stop loss",
      taskType: "strategy",
    });

    expect(result.pineVersion).toBe("v6");
    expect(result.editorContext).toEqual({
      currentCode: "",
      compilerErrors: [],
    });
  });

  it("rejects an empty prompt", () => {
    const result = GenerateRequestSchema.safeParse({
      prompt: "",
      taskType: "indicator",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported task type", () => {
    const result = GenerateRequestSchema.safeParse({
      prompt: "do something",
      taskType: "backtest",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported pine version", () => {
    const result = GenerateRequestSchema.safeParse({
      prompt: "do something",
      taskType: "indicator",
      pineVersion: "v5",
    });
    expect(result.success).toBe(false);
  });
});

describe("GenerateResponseSchema", () => {
  it("parses the TDD example response shape", () => {
    const result = GenerateResponseSchema.parse({
      title: "RSI ATR Strategy",
      summary: "Strategy using RSI entry logic and ATR-based risk controls.",
      code: "//@version=6",
      assumptions: ["Long-only", "Uses close price"],
      warnings: ["Backtest before live use"],
      usage: { requestsRemaining: 18 },
    });

    expect(result.usage.requestsRemaining).toBe(18);
    expect(result.assumptions).toHaveLength(2);
  });

  it("rejects negative requestsRemaining", () => {
    const result = GenerateResponseSchema.safeParse({
      title: "x",
      summary: "y",
      code: "z",
      usage: { requestsRemaining: -1 },
    });
    expect(result.success).toBe(false);
  });
});
