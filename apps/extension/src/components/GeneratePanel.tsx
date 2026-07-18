import { useCallback, useMemo, useState } from "react";
import {
  GenerateRequestSchema,
  TaskTypeSchema,
  type GenerateResponse,
  type TaskType,
} from "@pinepilot/shared";
import { useGenerate, type GenerateFn } from "../lib/generate/use-generate.js";
import type {
  EditorContextProvider,
  InsertHandler,
} from "../lib/generate/insert.js";

export interface GeneratePanelProps {
  onGenerate: GenerateFn;
  /** Injectable for tests; defaults to the Clipboard API. */
  onCopy?: (text: string) => Promise<void>;
  /**
   * Optional editor-insertion capability. When provided, the result renders an
   * "Insert into Pine Editor" action. The generate UI stays editor-agnostic —
   * the handler is supplied by an editor adapter.
   */
  onInsert?: InsertHandler;
  /** Optional live editor context merged into the request at submit time. */
  getEditorContext?: EditorContextProvider;
}

const TASK_TYPES = TaskTypeSchema.options;

function defaultCopy(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

function Spinner(): JSX.Element {
  return <span className="pp-spinner" aria-hidden="true" />;
}

function CodeBlock({
  result,
  onCopy,
  onInsert,
}: {
  result: GenerateResponse;
  onCopy: (text: string) => Promise<void>;
  onInsert?: InsertHandler;
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [insertMessage, setInsertMessage] = useState<string | null>(null);
  const [insertStatus, setInsertStatus] = useState<
    "inserted" | "copied" | null
  >(null);

  const handleCopy = useCallback(async () => {
    try {
      await onCopy(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [onCopy, result.code]);

  const handleInsert = useCallback(async () => {
    if (!onInsert) {
      return;
    }
    setInserting(true);
    try {
      const outcome = await onInsert(result.code);
      setInsertStatus(outcome.status);
      setInsertMessage(outcome.message);
    } catch {
      setInsertStatus("copied");
      setInsertMessage("Insertion failed. Use Copy code and paste manually.");
    } finally {
      setInserting(false);
    }
  }, [onInsert, result.code]);

  return (
    <div className="pp-code-wrap">
      <pre className="pp-code" tabIndex={0} aria-label="Generated Pine Script">
        <code>{result.code}</code>
      </pre>
      <div className="pp-code-bar">
        <span className="pp-meta">Pine v6</span>
        <div className="pp-code-actions">
          <button
            type="button"
            className="pp-btn pp-btn-ghost"
            onClick={handleCopy}
          >
            {copied ? "Copied" : "Copy code"}
          </button>
          {onInsert && (
            <button
              type="button"
              className="pp-btn pp-btn-primary pp-btn-sm"
              onClick={handleInsert}
              disabled={inserting}
              aria-busy={inserting}
            >
              {inserting ? (
                <>
                  <Spinner /> Inserting…
                </>
              ) : (
                "Insert into Pine Editor"
              )}
            </button>
          )}
        </div>
      </div>
      {insertMessage && (
        <div
          className={
            insertStatus === "inserted"
              ? "pp-insert-status pp-insert-status-ok"
              : "pp-insert-status"
          }
          role="status"
          data-testid="insert-status"
        >
          {insertMessage}
        </div>
      )}
    </div>
  );
}

function Result({
  result,
  taskType,
  onCopy,
  onInsert,
}: {
  result: GenerateResponse;
  taskType: TaskType;
  onCopy: (text: string) => Promise<void>;
  onInsert?: InsertHandler;
}): JSX.Element {
  return (
    <div className="pp-card" data-testid="generate-result">
      <div className="pp-card-head">
        <div>
          <h2 className="pp-card-title">{result.title}</h2>
          <p className="pp-card-summary">{result.summary}</p>
        </div>
        <span className="pp-badge pp-badge-muted">{taskType}</span>
      </div>

      <CodeBlock result={result} onCopy={onCopy} onInsert={onInsert} />

      {result.assumptions.length > 0 && (
        <div className="pp-section">
          <p className="pp-section-label">Assumptions</p>
          <ul className="pp-list">
            {result.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="pp-section">
          <p className="pp-section-label">
            <span className="pp-badge pp-badge-warning">Warnings</span>
          </p>
          <ul className="pp-list">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="pp-section">
        <p className="pp-disclaimer">
          Educational software assistance only — not financial advice. Review
          and backtest before use.
        </p>
      </div>
    </div>
  );
}

export function GeneratePanel({
  onGenerate,
  onCopy = defaultCopy,
  onInsert,
  getEditorContext,
}: GeneratePanelProps): JSX.Element {
  const [prompt, setPrompt] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("strategy");
  const { view, run } = useGenerate(onGenerate);

  const canSubmit = prompt.trim().length > 0 && view.status !== "loading";
  const isLoading = view.status === "loading";

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const editorContext = getEditorContext?.();
      const parsed = GenerateRequestSchema.safeParse({
        prompt,
        taskType,
        ...(editorContext ? { editorContext } : {}),
      });
      if (!parsed.success) {
        return;
      }
      void run(parsed.data);
    },
    [prompt, taskType, run, getEditorContext],
  );

  const successTaskType = useMemo(() => taskType, [taskType]);

  return (
    <div className="pp-body">
      <form className="pp-field" onSubmit={submit}>
        <label className="pp-label" htmlFor="pp-prompt">
          Describe your indicator or strategy
        </label>
        <textarea
          id="pp-prompt"
          className="pp-textarea"
          placeholder="e.g. RSI + EMA crossover strategy with an ATR stop loss"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isLoading}
        />

        <div className="pp-field">
          <span className="pp-label" id="pp-tasktype-label">
            Output type
          </span>
          <div
            className="pp-segmented"
            role="group"
            aria-labelledby="pp-tasktype-label"
          >
            {TASK_TYPES.map((t) => (
              <button
                type="button"
                key={t}
                className="pp-segment"
                aria-pressed={taskType === t}
                onClick={() => setTaskType(t)}
                disabled={isLoading}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="pp-btn pp-btn-primary pp-btn-block"
          disabled={!canSubmit}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <Spinner /> Generating…
            </>
          ) : (
            "Generate Pine Script"
          )}
        </button>
      </form>

      <div aria-live="polite">
        {view.status === "idle" && (
          <div className="pp-empty" data-testid="generate-empty">
            Describe what you want to build, then generate runnable Pine v6.
          </div>
        )}

        {view.status === "loading" && (
          <div
            className="pp-loading"
            role="status"
            data-testid="generate-loading"
          >
            <Spinner />
            <span>Generating Pine Script…</span>
          </div>
        )}

        {view.status === "error" && (
          <div
            className="pp-alert pp-alert-error"
            role="alert"
            data-testid="generate-error"
          >
            <span>{view.message}</span>
          </div>
        )}

        {view.status === "quota" && (
          <div
            className="pp-alert pp-alert-quota"
            role="alert"
            data-testid="generate-quota"
          >
            <span>{view.message}</span>
          </div>
        )}

        {view.status === "success" && (
          <Result
            result={view.result}
            taskType={successTaskType}
            onCopy={onCopy}
            onInsert={onInsert}
          />
        )}
      </div>
    </div>
  );
}

export default GeneratePanel;
