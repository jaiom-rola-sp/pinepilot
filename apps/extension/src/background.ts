import { ApiClient } from "./lib/api-client.js";
import { AuthManager } from "./lib/auth-manager.js";
import { readConfig } from "./lib/config.js";
import { ChromeIdentityGoogleProvider } from "./lib/google-auth.js";
import { handleBackgroundRequest } from "./lib/message-handler.js";
import {
  isBackgroundRequest,
  type AuthStateChangedEvent,
} from "./lib/messages.js";
import { ChromeSessionTokenStore } from "./lib/token-store.js";

const config = readConfig();

const manager = new AuthManager({
  provider: new ChromeIdentityGoogleProvider(config.googleClientId),
  api: new ApiClient({ baseUrl: config.apiBaseUrl }),
  store: new ChromeSessionTokenStore(),
});

// Broadcast state changes so any open popup/panel can update reactively.
manager.subscribe((state) => {
  const event: AuthStateChangedEvent = {
    type: "AUTH_STATE_CHANGED",
    state,
  };
  void chrome.runtime.sendMessage(event).catch(() => {
    // No listeners (e.g. popup closed) — safe to ignore.
  });
});

// Attempt to restore a session whenever the worker starts.
void manager.initialize();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isBackgroundRequest(message)) {
    return false;
  }
  handleBackgroundRequest(manager, message)
    .then(sendResponse)
    .catch((err: unknown) => {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : "Unexpected error",
      });
    });
  // Returning true keeps the message channel open for the async response.
  return true;
});
