import { useCallback, useEffect, useState } from "react";
import {
  requestAuthState,
  requestGenerate,
  requestSignIn,
  requestSignOut,
} from "./lib/messaging-client.js";
import { isAuthStateChangedEvent } from "./lib/messages.js";
import { INITIAL_AUTH_STATE, type AuthState } from "./lib/types.js";
import { GeneratePanel } from "./components/GeneratePanel.js";
import "./styles/tokens.css";

function Popup(): JSX.Element {
  const [state, setState] = useState<AuthState>(INITIAL_AUTH_STATE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void requestAuthState()
      .then(setState)
      .catch(() => undefined);

    const listener = (message: unknown): void => {
      if (isAuthStateChangedEvent(message)) {
        setState(message.state);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const onSignIn = useCallback(async () => {
    setBusy(true);
    try {
      setState(await requestSignIn());
    } catch {
      /* handled via broadcast */
    } finally {
      setBusy(false);
    }
  }, []);

  const onSignOut = useCallback(async () => {
    setBusy(true);
    try {
      setState(await requestSignOut());
    } finally {
      setBusy(false);
    }
  }, []);

  const signedIn = state.status === "signedIn";

  return (
    <div className="pp-root">
      <header className="pp-header">
        <div className="pp-brand">
          <span className="pp-brand-mark" />
          PinePilot
        </div>
        {signedIn ? (
          <button
            type="button"
            className="pp-btn pp-btn-ghost"
            disabled={busy}
            onClick={onSignOut}
          >
            {state.user?.email ?? "Account"} · Sign out
          </button>
        ) : (
          <button
            type="button"
            className="pp-btn pp-btn-ghost"
            disabled={busy || state.status === "signingIn"}
            onClick={onSignIn}
          >
            {state.status === "signingIn" ? "Signing in…" : "Sign in"}
          </button>
        )}
      </header>

      {signedIn ? (
        <GeneratePanel onGenerate={requestGenerate} />
      ) : (
        <div className="pp-signedout">
          {state.status === "error" ? (
            <span>Sign-in failed: {state.error}</span>
          ) : (
            <span>Sign in with Google to generate Pine Script.</span>
          )}
        </div>
      )}
    </div>
  );
}

export default Popup;
