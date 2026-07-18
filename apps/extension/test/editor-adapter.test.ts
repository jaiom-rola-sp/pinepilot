import { afterEach, describe, expect, it, vi } from "vitest";
import { DomPineEditorAdapter } from "../src/lib/tradingview/editor-adapter.js";

function mountEditor(): void {
  document.body.innerHTML = `
    <div data-name="scripteditor">
      <div class="view-lines">
        <div class="view-line">//@version=6</div>
        <div class="view-line">indicator("x")</div>
      </div>
      <textarea class="inputarea"></textarea>
      <div class="tv-script-console__message--error">line 2: syntax error</div>
    </div>
  `;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("DomPineEditorAdapter.detectCapability", () => {
  it("reports 'insert' when the editor input exists", () => {
    mountEditor();
    const adapter = new DomPineEditorAdapter({ doc: document });
    expect(adapter.detectCapability()).toBe("insert");
  });

  it("reports 'copy-only' when the editor is absent", () => {
    document.body.innerHTML = `<div class="chart"></div>`;
    const adapter = new DomPineEditorAdapter({ doc: document });
    expect(adapter.detectCapability()).toBe("copy-only");
  });
});

describe("DomPineEditorAdapter.readContext", () => {
  it("reads current code and compiler errors defensively", () => {
    mountEditor();
    const adapter = new DomPineEditorAdapter({ doc: document });
    const ctx = adapter.readContext();
    expect(ctx.currentCode).toContain("@version=6");
    expect(ctx.currentCode).toContain('indicator("x")');
    expect(ctx.compilerErrors).toEqual(["line 2: syntax error"]);
  });

  it("returns empty context when nothing is present", () => {
    document.body.innerHTML = "";
    const adapter = new DomPineEditorAdapter({ doc: document });
    expect(adapter.readContext()).toEqual({
      currentCode: "",
      compilerErrors: [],
    });
  });
});

describe("DomPineEditorAdapter.insert", () => {
  it("inserts via execCommand on the success path", async () => {
    mountEditor();
    const execCommand = vi.fn().mockReturnValue(true);
    // jsdom lacks execCommand; inject a passing implementation.
    (document as unknown as { execCommand: unknown }).execCommand = execCommand;
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    const adapter = new DomPineEditorAdapter({ doc: document, writeClipboard });

    const result = await adapter.insert("//@version=6\nindicator('y')");

    expect(result.status).toBe("inserted");
    expect(execCommand).toHaveBeenCalledWith(
      "insertText",
      false,
      "//@version=6\nindicator('y')",
    );
    expect(writeClipboard).not.toHaveBeenCalled();
  });

  it("falls back to clipboard when the editor is absent", async () => {
    document.body.innerHTML = "";
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    const adapter = new DomPineEditorAdapter({ doc: document, writeClipboard });

    const result = await adapter.insert("code");

    expect(result.status).toBe("copied");
    expect(result.message).toMatch(/copied/i);
    expect(writeClipboard).toHaveBeenCalledWith("code");
  });

  it("falls back to clipboard when execCommand reports failure", async () => {
    mountEditor();
    (document as unknown as { execCommand: unknown }).execCommand = vi
      .fn()
      .mockReturnValue(false);
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    const adapter = new DomPineEditorAdapter({ doc: document, writeClipboard });

    const result = await adapter.insert("code");

    expect(result.status).toBe("copied");
    expect(writeClipboard).toHaveBeenCalledWith("code");
  });
});
