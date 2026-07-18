import styleText from "data-text:../styles/tokens.css";
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo";
import { useEffect, useState } from "react";
import { InPagePanel } from "../components/InPagePanel.js";
import { DomPineEditorAdapter } from "../lib/tradingview/editor-adapter.js";
import { shouldEnablePanel } from "../lib/tradingview/page-detection.js";
import { isAuthStateChangedEvent } from "../lib/messages.js";
import { requestAuthState, requestGenerate } from "../lib/messaging-client.js";

export const config: PlasmoCSConfig = {
  matches: ["https://*.tradingview.com/*"],
  run_at: "document_idle",
};

/** Inject the shared design tokens into the CSUI shadow root. */
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style");
  style.textContent = styleText;
  return style;
};

// A single adapter instance is fine; it reads the live DOM on each call.
const adapter = new DomPineEditorAdapter();

function TradingViewPanel(): JSX.Element | null {
  const [enabled] = useState(() => shouldEnablePanel(location.href));
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void requestAuthState()
      .then((state) => setSignedIn(state.status === "signedIn"))
      .catch(() => undefined);

    const listener = (message: unknown): void => {
      if (isAuthStateChangedEvent(message)) {
        setSignedIn(message.state.status === "signedIn");
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <InPagePanel
      onGenerate={requestGenerate}
      adapter={adapter}
      signedIn={signedIn}
    />
  );
}

export default TradingViewPanel;
