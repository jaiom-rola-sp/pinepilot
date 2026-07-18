import type { PlasmoCSConfig } from "plasmo";
import { requestAuthState } from "../lib/messaging-client.js";

/**
 * Minimal content script for TradingView. A2 scope: establish the content ->
 * background messaging channel only. It does NOT read or inject into the Pine
 * Editor — that arrives in the TradingView integration milestone.
 */
export const config: PlasmoCSConfig = {
  matches: ["https://*.tradingview.com/*"],
  run_at: "document_idle",
};

async function init(): Promise<void> {
  try {
    const state = await requestAuthState();
    // Placeholder: later milestones use auth state to gate the assistant UI.
    console.debug(
      "[PinePilot] TradingView detected; auth status:",
      state.status,
    );
  } catch {
    // Background not ready; the assistant simply stays dormant.
  }
}

void init();
