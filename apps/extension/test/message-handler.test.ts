import { describe, expect, it } from "vitest";
import type { GenerateRequest, GenerateResponse } from "@pinepilot/shared";
import { ApiError } from "../src/lib/api-client.js";
import { AuthManager } from "../src/lib/auth-manager.js";
import { handleBackgroundRequest } from "../src/lib/message-handler.js";
import { InMemoryTokenStore } from "../src/lib/token-store.js";
import type { AuthState, AuthUser } from "../src/lib/types.js";
import { FakeAuthApi, FakeGoogleProvider } from "./fakes.js";

const sampleRequest: GenerateRequest = {
  prompt: "RSI strategy",
  taskType: "strategy",
  pineVersion: "v6",
  editorContext: { currentCode: "", compilerErrors: [] },
};

function makeManager() {
  const api = new FakeAuthApi();
  const manager = new AuthManager({
    provider: new FakeGoogleProvider(),
    api,
    store: new InMemoryTokenStore(),
  });
  return { manager, api };
}

describe("handleBackgroundRequest", () => {
  it("AUTH_GET_STATE returns the current state", async () => {
    const { manager } = makeManager();
    const res = await handleBackgroundRequest(manager, {
      type: "AUTH_GET_STATE",
    });
    expect(res.ok).toBe(true);
    expect((res as { data: AuthState }).data.status).toBe("signedOut");
  });

  it("AUTH_SIGN_IN drives the manager to signedIn", async () => {
    const { manager } = makeManager();
    const res = await handleBackgroundRequest(manager, {
      type: "AUTH_SIGN_IN",
    });
    expect(res.ok).toBe(true);
    expect((res as { data: AuthState }).data.status).toBe("signedIn");
  });

  it("AUTH_GET_ME returns the user after sign-in", async () => {
    const { manager } = makeManager();
    await handleBackgroundRequest(manager, { type: "AUTH_SIGN_IN" });
    const res = await handleBackgroundRequest(manager, { type: "AUTH_GET_ME" });
    expect(res.ok).toBe(true);
    expect((res as { data: AuthUser }).data.email).toBe("trader@example.com");
  });

  it("returns ok:false with a message on failure", async () => {
    const { manager } = makeManager();
    // No session -> getMe throws -> handler returns an error envelope.
    const res = await handleBackgroundRequest(manager, { type: "AUTH_GET_ME" });
    expect(res.ok).toBe(false);
    expect((res as { error: string }).error).toBeTruthy();
  });

  it("AUTH_SIGN_OUT returns signedOut", async () => {
    const { manager } = makeManager();
    await handleBackgroundRequest(manager, { type: "AUTH_SIGN_IN" });
    const res = await handleBackgroundRequest(manager, {
      type: "AUTH_SIGN_OUT",
    });
    expect(res.ok).toBe(true);
    expect((res as { data: AuthState }).data.status).toBe("signedOut");
  });

  it("API_GENERATE returns the generated result after sign-in", async () => {
    const { manager } = makeManager();
    await handleBackgroundRequest(manager, { type: "AUTH_SIGN_IN" });
    const res = await handleBackgroundRequest(manager, {
      type: "API_GENERATE",
      request: { ...sampleRequest },
    });
    expect(res.ok).toBe(true);
    expect((res as { data: GenerateResponse }).data.title).toBeTruthy();
  });

  it("API_GENERATE surfaces the HTTP status on quota failure", async () => {
    const { manager, api } = makeManager();
    await handleBackgroundRequest(manager, { type: "AUTH_SIGN_IN" });
    api.generateError = new ApiError(429, "quota exceeded");
    const res = await handleBackgroundRequest(manager, {
      type: "API_GENERATE",
      request: { ...sampleRequest },
    });
    expect(res.ok).toBe(false);
    expect((res as { status?: number }).status).toBe(429);
  });
});
