import { useCallback, useMemo, useState } from "react";
import { GeneratePanel } from "./GeneratePanel.js";
import type { GenerateFn } from "../lib/generate/use-generate.js";
import type { PineEditorAdapter } from "../lib/tradingview/editor-adapter.js";

export interface InPagePanelProps {
  onGenerate: GenerateFn;
  adapter: PineEditorAdapter;
  /** Whether the user has an authenticated session (owned by the background). */
  signedIn: boolean;
  /** Start expanded (used by tests / optional persisted preference). */
  defaultOpen?: boolean;
}

/**
 * Floating in-page surface for TradingView chart pages. Owns only presentation
 * and open/close state; generation is routed through the injected `onGenerate`
 * (background worker) and all editor interaction through the injected adapter.
 */
export function InPagePanel({
  onGenerate,
  adapter,
  signedIn,
  defaultOpen = false,
}: InPagePanelProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  // Capability is probed once when the panel opens; the editor pane rarely
  // toggles mid-session, and re-probing is cheap if we later need it.
  const capability = useMemo(
    () => (open ? adapter.detectCapability() : "copy-only"),
    [open, adapter],
  );

  const canInsert = capability === "insert";

  const handleInsert = useCallback(
    (code: string) => adapter.insert(code),
    [adapter],
  );

  const getEditorContext = useCallback(() => adapter.readContext(), [adapter]);

  if (!open) {
    return (
      <button
        type="button"
        className="pp-fab"
        aria-label="Open PinePilot"
        onClick={() => setOpen(true)}
      >
        <span className="pp-brand-mark" />
        PinePilot
      </button>
    );
  }

  return (
    <div className="pp-root pp-floating" role="dialog" aria-label="PinePilot">
      <header className="pp-header">
        <div className="pp-brand">
          <span className="pp-brand-mark" />
          PinePilot
        </div>
        <button
          type="button"
          className="pp-btn pp-btn-ghost pp-btn-icon"
          aria-label="Close PinePilot"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </header>

      {signedIn ? (
        <>
          <div className="pp-capability" data-testid="capability-badge">
            {canInsert ? (
              <span className="pp-badge pp-badge-success">
                Pine Editor detected
              </span>
            ) : (
              <span className="pp-badge pp-badge-muted">
                Pine Editor not detected — copy &amp; paste
              </span>
            )}
          </div>
          <GeneratePanel
            onGenerate={onGenerate}
            onInsert={canInsert ? handleInsert : undefined}
            getEditorContext={canInsert ? getEditorContext : undefined}
          />
          {!canInsert && (
            <div className="pp-body pp-body-tight">
              <p className="pp-disclaimer" data-testid="fallback-guidance">
                Open the Pine Editor (bottom of the chart) to enable one-click
                insert. Until then, use Copy code and paste manually.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="pp-signedout" data-testid="inpage-signedout">
          Open the PinePilot extension icon to sign in, then return here to
          generate on the chart.
        </div>
      )}
    </div>
  );
}

export default InPagePanel;
