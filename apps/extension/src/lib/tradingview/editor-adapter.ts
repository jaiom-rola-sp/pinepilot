import type { EditorContext } from "@pinepilot/shared";
import type { InsertResult } from "../generate/insert.js";
import { TRADINGVIEW_SELECTORS, queryAll, queryFirst } from "./selectors.js";

/**
 * `insert`   - the editor input was found; direct insertion will be attempted.
 * `copy-only` - the editor was not found; only clipboard fallback is offered.
 */
export type EditorCapability = "insert" | "copy-only";

/**
 * Service boundary over the (fragile) TradingView Pine Editor DOM. All editor
 * interaction lives behind this interface so the UI never touches selectors and
 * the implementation can be swapped as TradingView changes.
 */
export interface PineEditorAdapter {
  detectCapability(): EditorCapability;
  readContext(): EditorContext;
  insert(code: string): Promise<InsertResult>;
}

export interface DomPineEditorAdapterOptions {
  doc?: Document;
  /** Injected for testing; defaults to the Clipboard API. */
  writeClipboard?: (text: string) => Promise<void>;
}

const COPY_MSG_NO_EDITOR =
  "Pine Editor not found. Code copied — open the Pine Editor and paste (Ctrl/Cmd+V).";
const COPY_MSG_FALLBACK =
  "Couldn't insert automatically. Code copied — click the Pine Editor and paste (Ctrl/Cmd+V).";
const INSERT_OK_MSG = "Inserted into the Pine Editor.";

/**
 * DOM-backed adapter. Insertion is intentionally conservative: TradingView uses
 * a Monaco-style editor whose model we cannot reach from an isolated content
 * script, so we never claim success we can't observe. We attempt a focus +
 * `execCommand("insertText")` and trust its boolean return; anything else
 * degrades to an honest clipboard fallback.
 */
export class DomPineEditorAdapter implements PineEditorAdapter {
  private readonly doc: Document;
  private readonly writeClipboard: (text: string) => Promise<void>;

  constructor(options: DomPineEditorAdapterOptions = {}) {
    this.doc = options.doc ?? document;
    this.writeClipboard =
      options.writeClipboard ??
      ((text: string) => navigator.clipboard.writeText(text));
  }

  detectCapability(): EditorCapability {
    return this.findInput() ? "insert" : "copy-only";
  }

  readContext(): EditorContext {
    return {
      currentCode: this.readCurrentCode(),
      compilerErrors: this.readCompilerErrors(),
    };
  }

  async insert(code: string): Promise<InsertResult> {
    const input = this.findInput();
    if (!input) {
      await this.safeCopy(code);
      return { status: "copied", message: COPY_MSG_NO_EDITOR };
    }

    try {
      input.focus();
      const selectedAll = this.doc.execCommand("selectAll");
      const inserted = this.doc.execCommand("insertText", false, code);
      if (selectedAll && inserted) {
        return { status: "inserted", message: INSERT_OK_MSG };
      }
    } catch {
      // Fall through to clipboard fallback below.
    }

    await this.safeCopy(code);
    return { status: "copied", message: COPY_MSG_FALLBACK };
  }

  private findInput(): HTMLElement | null {
    const el = queryFirst(this.doc, TRADINGVIEW_SELECTORS.editorInput);
    return el instanceof HTMLElement ? el : null;
  }

  private readCurrentCode(): string {
    try {
      const lines = queryAll(this.doc, TRADINGVIEW_SELECTORS.editorLine);
      if (lines.length === 0) {
        return "";
      }
      return lines
        .map((line) => line.textContent ?? "")
        .join("\n")
        .replace(/\u00a0/g, " ")
        .trimEnd();
    } catch {
      return "";
    }
  }

  private readCompilerErrors(): string[] {
    try {
      return queryAll(this.doc, TRADINGVIEW_SELECTORS.consoleErrors)
        .map((el) => (el.textContent ?? "").trim())
        .filter((text) => text.length > 0);
    } catch {
      return [];
    }
  }

  private async safeCopy(code: string): Promise<void> {
    try {
      await this.writeClipboard(code);
    } catch {
      // Clipboard may be blocked; the message still guides manual copy.
    }
  }
}
