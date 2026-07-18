import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GenerateResponse } from "@pinepilot/shared";
import { InPagePanel } from "../src/components/InPagePanel.js";
import type {
  EditorCapability,
  PineEditorAdapter,
} from "../src/lib/tradingview/editor-adapter.js";
import type { InsertResult } from "../src/lib/generate/insert.js";

const result: GenerateResponse = {
  title: "EMA Crossover",
  summary: "Fast/slow EMA crossover.",
  code: "//@version=6\nindicator('EMA')\nplot(close)",
  assumptions: [],
  warnings: [],
  usage: { requestsRemaining: 9 },
};

function makeAdapter(
  capability: EditorCapability,
  insertResult: InsertResult = {
    status: "inserted",
    message: "Inserted into the Pine Editor.",
  },
): PineEditorAdapter & { insert: ReturnType<typeof vi.fn> } {
  return {
    detectCapability: () => capability,
    readContext: () => ({ currentCode: "prev", compilerErrors: [] }),
    insert: vi.fn().mockResolvedValue(insertResult),
  };
}

async function generate(): Promise<void> {
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText(/describe your indicator or strategy/i),
    "EMA crossover",
  );
  await user.click(
    screen.getByRole("button", { name: /generate pine script/i }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("generate-result")).toBeInTheDocument(),
  );
}

describe("InPagePanel mount/show", () => {
  it("shows a launcher and expands to the panel on click", async () => {
    const user = userEvent.setup();
    render(
      <InPagePanel
        onGenerate={vi.fn()}
        adapter={makeAdapter("insert")}
        signedIn
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /open pinepilot/i }));
    expect(
      screen.getByRole("dialog", { name: /pinepilot/i }),
    ).toBeInTheDocument();
  });

  it("shows a signed-out notice instead of the form when unauthenticated", () => {
    render(
      <InPagePanel
        onGenerate={vi.fn()}
        adapter={makeAdapter("insert")}
        signedIn={false}
        defaultOpen
      />,
    );

    expect(screen.getByTestId("inpage-signedout")).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/describe your indicator/i),
    ).not.toBeInTheDocument();
  });
});

describe("InPagePanel editor capability", () => {
  it("detects the editor and inserts generated code (success path)", async () => {
    const adapter = makeAdapter("insert");
    const onGenerate = vi.fn().mockResolvedValue(result);
    render(
      <InPagePanel
        onGenerate={onGenerate}
        adapter={adapter}
        signedIn
        defaultOpen
      />,
    );

    expect(screen.getByTestId("capability-badge")).toHaveTextContent(
      /detected/i,
    );

    await generate();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /insert into pine editor/i }),
    );

    expect(adapter.insert).toHaveBeenCalledWith(result.code);
    expect(await screen.findByTestId("insert-status")).toHaveTextContent(
      /inserted/i,
    );
  });

  it("degrades to copy-only with guidance when the editor is unavailable", async () => {
    const adapter = makeAdapter("copy-only");
    const onGenerate = vi.fn().mockResolvedValue(result);
    render(
      <InPagePanel
        onGenerate={onGenerate}
        adapter={adapter}
        signedIn
        defaultOpen
      />,
    );

    expect(screen.getByTestId("capability-badge")).toHaveTextContent(
      /not detected/i,
    );
    expect(screen.getByTestId("fallback-guidance")).toBeInTheDocument();

    await generate();

    expect(
      screen.queryByRole("button", { name: /insert into pine editor/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy code/i }),
    ).toBeInTheDocument();
    expect(adapter.insert).not.toHaveBeenCalled();
  });

  it("surfaces a clipboard-fallback outcome from the adapter", async () => {
    const adapter = makeAdapter("insert", {
      status: "copied",
      message: "Couldn't insert automatically. Code copied — paste manually.",
    });
    const onGenerate = vi.fn().mockResolvedValue(result);
    render(
      <InPagePanel
        onGenerate={onGenerate}
        adapter={adapter}
        signedIn
        defaultOpen
      />,
    );

    await generate();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /insert into pine editor/i }),
    );

    expect(await screen.findByTestId("insert-status")).toHaveTextContent(
      /copied/i,
    );
  });
});
