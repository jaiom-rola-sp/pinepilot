import { useCallback, useEffect, useState } from "react";
import {
  requestAuthState,
  requestSignIn,
  requestSignOut,
} from "./lib/messaging-client.js";
import { isAuthStateChangedEvent } from "./lib/messages.js";
import { INITIAL_AUTH_STATE, type AuthState } from "./lib/types.js";

const containerStyle: React.CSSProperties = {
  width: 300,
  padding: 16,
  fontFamily: "system-ui, sans-serif",
  fontSize: 14,
};

function StatusLine({ state }: { state: AuthState }): JSX.Element {
  switch (state.status) {
    case "signedIn":
      return <p>Signed in as {state.user?.email}</p>;
    case "signingIn":
      return <p>Signing in…</p>;
    case "error":
      return <p style={{ color: "#b00020" }}>Error: {state.error}</p>;
    case "signedOut":
    default:
      return <p>You are signed out.</p>;
  }
}

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
    } catch (err) {
      setState({
        status: "error",
        user: null,
        error: err instanceof Error ? err.message : "Sign-in failed",
      });
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
    <div style={containerStyle}>
      <h1 style={{ fontSize: 16, margin: "0 0 12px" }}>PinePilot</h1>
      <StatusLine state={state} />
      {signedIn ? (
        <button type="button" disabled={busy} onClick={onSignOut}>
          Sign out
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || state.status === "signingIn"}
          onClick={onSignIn}
        >
          Sign in with Google
        </button>
      )}
    </div>
  );
}

export default Popup;
