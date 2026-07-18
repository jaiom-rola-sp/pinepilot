// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GenerateResponse } from "@pinepilot/shared";
import { GeneratePanel } from "../src/components/GeneratePanel.js";
import { BackgroundRequestError } from "../src/lib/messaging-client.js";

const result: GenerateResponse = {
  title: "EMA Crossover",
  summary: "Buys on fast/slow EMA crossover.",
  code: "//@version=6\nindicator('EMA Crossover')\nplot(close)",
  assumptions: ["Uses daily timeframe"],
  warnings: ["Not financial advice"],
  usage: { requestsRemaining: 5 },
};

async function typePrompt(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText(/describe your indicator or strategy/i),
    "EMA crossover",
  );
  return user;
}

function generateButton(): HTMLElement {
  return screen.getByRole("button", { name: /generat/i });
}

describe("GeneratePanel", () => {
  it("renders the empty state before any generation", () => {
    render(<GeneratePanel onGenerate={vi.fn()} />);
    expect(screen.getByTestId("generate-empty")).toBeInTheDocument();
  });

  it("runs a full success flow and renders the result", async () => {
    const onGenerate = vi.fn().mockResolvedValue(result);
    render(<GeneratePanel onGenerate={onGenerate} />);

    const user = await typePrompt();
    await user.click(generateButton());

    await waitFor(() =>
      expect(screen.getByTestId("generate-result")).toBeInTheDocument(),
    );
    expect(screen.getByText("EMA Crossover")).toBeInTheDocument();
    expect(
      screen.getByText("Buys on fast/slow EMA crossover."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Uses daily timeframe/)).toBeInTheDocument();
    expect(screen.getByLabelText(/generated pine script/i)).toHaveTextContent(
      "@version=6",
    );

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "EMA crossover",
        taskType: "strategy",
      }),
    );
  });

  it("shows a loading state while the request is pending", async () => {
    const onGenerate = vi.fn(() => new Promise<GenerateResponse>(() => {}));
    render(<GeneratePanel onGenerate={onGenerate} />);

    const user = await typePrompt();
    await user.click(generateButton());

    expect(await screen.findByTestId("generate-loading")).toBeInTheDocument();
    expect(generateButton()).toHaveAttribute("aria-busy", "true");
    expect(generateButton()).toBeDisabled();
  });

  it("shows an error state when generation fails", async () => {
    const onGenerate = vi.fn().mockRejectedValue(new Error("provider down"));
    render(<GeneratePanel onGenerate={onGenerate} />);

    const user = await typePrompt();
    await user.click(generateButton());

    const alert = await screen.findByTestId("generate-error");
    expect(alert).toHaveTextContent("provider down");
  });

  it("shows a quota state when the backend reports a usage limit", async () => {
    const onGenerate = vi
      .fn()
      .mockRejectedValue(new BackgroundRequestError("quota exceeded", 429));
    render(<GeneratePanel onGenerate={onGenerate} />);

    const user = await typePrompt();
    await user.click(generateButton());

    const alert = await screen.findByTestId("generate-quota");
    expect(alert).toHaveTextContent(/limit/i);
    expect(screen.queryByTestId("generate-error")).not.toBeInTheDocument();
  });

  it("copies the generated code to the clipboard", async () => {
    const onGenerate = vi.fn().mockResolvedValue(result);
    const onCopy = vi.fn().mockResolvedValue(undefined);
    render(<GeneratePanel onGenerate={onGenerate} onCopy={onCopy} />);

    const user = await typePrompt();
    await user.click(generateButton());
    await screen.findByTestId("generate-result");

    await user.click(screen.getByRole("button", { name: /copy code/i }));

    expect(onCopy).toHaveBeenCalledWith(result.code);
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("does not submit when the prompt is empty", async () => {
    const onGenerate = vi.fn();
    render(<GeneratePanel onGenerate={onGenerate} />);
    expect(generateButton()).toBeDisabled();
    expect(onGenerate).not.toHaveBeenCalled();
  });
});
