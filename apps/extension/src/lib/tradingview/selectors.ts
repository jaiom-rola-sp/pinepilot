/**
 * Centralized, replaceable TradingView DOM selectors.
 *
 * TradingView ships an obfuscated, frequently-changing SPA, so every selector
 * here is treated as best-effort and fragile. Each target lists multiple
 * candidates (most specific first); consumers try them in order and degrade
 * gracefully when none match. Keep ALL TradingView DOM knowledge in this file
 * so it can be updated in one place when the page changes.
 */
export const TRADINGVIEW_SELECTORS = {
  /** Root container of the Pine Editor pane. */
  pineEditorRoot: [
    '[data-name="scripteditor"]',
    '[class*="pine-editor"]',
    ".js-editor-view",
    ".tv-script-editor",
  ],

  /** The focusable input that actually receives keystrokes (Monaco/CodeMirror). */
  editorInput: [
    '[data-name="scripteditor"] textarea.inputarea',
    '[data-name="scripteditor"] textarea',
    ".monaco-editor textarea.inputarea",
    ".monaco-editor textarea",
    ".CodeMirror textarea",
  ],

  /** Rendered code lines, used to read the current source defensively. */
  editorLines: [
    '[data-name="scripteditor"] .view-lines',
    ".monaco-editor .view-lines",
    ".CodeMirror-code",
  ],

  /** Individual rendered line node within {@link editorLines}. */
  editorLine: [".view-line", ".CodeMirror-line"],

  /** Compiler/console error rows shown beneath the editor. */
  consoleErrors: [
    '[data-name="scripteditor"] [class*="errorContainer"] [class*="error"]',
    '[class*="pine-console"] [class*="error"]',
    ".tv-script-console__message--error",
    ".js-rooter-warning--error",
  ],
} as const;

export type SelectorGroup = keyof typeof TRADINGVIEW_SELECTORS;

/** Return the first element matching any candidate selector in a group. */
export function queryFirst(
  root: ParentNode,
  candidates: readonly string[],
): Element | null {
  for (const selector of candidates) {
    const el = root.querySelector(selector);
    if (el) {
      return el;
    }
  }
  return null;
}

/** Return all elements matching the first candidate selector that matches any. */
export function queryAll(
  root: ParentNode,
  candidates: readonly string[],
): Element[] {
  for (const selector of candidates) {
    const nodes = root.querySelectorAll(selector);
    if (nodes.length > 0) {
      return Array.from(nodes);
    }
  }
  return [];
}
