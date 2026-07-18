import type { EditorContext } from "@pinepilot/shared";

/**
 * Presentational contract for an optional "insert generated code" capability the
 * generate result UI can render. Deliberately framework/editor-agnostic: the
 * generate layer knows nothing about TradingView. Concrete editor adapters
 * (e.g. the Pine Editor adapter) depend on this contract, never the reverse.
 */
export interface InsertResult {
  /** `inserted` = code placed into the editor; `copied` = clipboard fallback. */
  status: "inserted" | "copied";
  /** User-facing, actionable message describing what happened. */
  message: string;
}

export type InsertHandler = (code: string) => Promise<InsertResult>;

/** Provides live editor context (current code, compiler errors) at submit time. */
export type EditorContextProvider = () => EditorContext;
