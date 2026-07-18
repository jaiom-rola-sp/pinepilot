import { beforeEach, describe, expect, it } from "vitest";
import type { GenerateRequest } from "@pinepilot/shared";
import { AuthManager } from "../src/lib/auth-manager.js";
import { InMemoryTokenStore } from "../src/lib/token-store.js";
import { FakeAuthApi, FakeGoogleProvider } from "./fakes.js";

function setup(startTime = 1_000_000) {
  const provider = new FakeGoogleProvider();
  const api = new FakeAuthApi();
  const store = new InMemoryTokenStore();
  let clock = startTime;
  const manager = new AuthManager({
    provider,
    api,
    store,
    now: () => clock,
  });
  return {
    provider,
    api,
    store,
    manager,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("AuthManager sign-in", () => {
  it("transitions signedOut -> signingIn -> signedIn on success", async () => {
    const { manager, store } = setup();
    const states: string[] = [];
    manager.subscribe((s) => states.push(s.status));

    expect(manager.getState().status).toBe("signedOut");
    const result = await manager.signIn();

    expect(result.status).toBe("signedIn");
    expect(result.user?.email).toBe("trader@example.com");
    expect(states).toEqual(["signingIn", "signedIn"]);
    // Refresh token persisted; access token is never exposed in state.
    expect(await store.getRefreshToken()).toBe("refresh-1");
    expect(result).not.toHaveProperty("accessToken");
  });

  it("transitions to error when Google sign-in fails", async () => {
    const { manager, provider } = setup();
    provider.shouldFail = true;

    const result = await manager.signIn();

    expect(result.status).toBe("error");
    expect(result.error).toContain("sign-in cancelled");
    expect(result.user).toBeNull();
  });

  it("transitions to error when the backend login fails", async () => {
    const { manager, api } = setup();
    api.failLogin = true;

    const result = await manager.signIn();

    expect(result.status).toBe("error");
    expect(result.error).toContain("login failed");
  });
});

describe("AuthManager getMe / refresh", () => {
  it("calls /me with the in-memory access token without refreshing", async () => {
    const { manager, api } = setup();
    await manager.signIn();

    const user = await manager.getMe();

    expect(user.email).toBe("trader@example.com");
    expect(api.calls.me).toBe(1);
    expect(api.calls.refresh).toBe(0);
    expect(api.lastAccessToken).toBe("access-1");
  });

  it("refreshes the access token when it is expired, then calls /me", async () => {
    const { manager, api, advance } = setup();
    await manager.signIn(); // expiresIn 900s

    advance(901_000); // push past expiry + skew

    const user = await manager.getMe();

    expect(api.calls.refresh).toBe(1);
    expect(api.lastAccessToken).toBe("access-2"); // rotated token used
    expect(user.email).toBe("trader@example.com");
  });

  it("signs out and throws when refresh fails", async () => {
    const { manager, api, advance } = setup();
    await manager.signIn();
    advance(901_000);
    api.failRefresh = true;

    await expect(manager.getMe()).rejects.toThrow();
    expect(manager.getState().status).toBe("signedOut");
  });
});

describe("AuthManager sign-out", () => {
  it("clears session state and the stored refresh token", async () => {
    const { manager, store } = setup();
    await manager.signIn();
    expect(await store.getRefreshToken()).toBe("refresh-1");

    const result = await manager.signOut();

    expect(result.status).toBe("signedOut");
    expect(result.user).toBeNull();
    expect(await store.getRefreshToken()).toBeNull();
    // Subsequent authenticated calls fail (no session).
    await expect(manager.getMe()).rejects.toThrow();
  });
});

describe("AuthManager initialize", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it("stays signedOut when no refresh token is stored", async () => {
    const result = await ctx.manager.initialize();
    expect(result.status).toBe("signedOut");
    expect(ctx.api.calls.refresh).toBe(0);
  });

  it("restores a session from a stored refresh token", async () => {
    await ctx.store.setRefreshToken("refresh-existing");
    const result = await ctx.manager.initialize();
    expect(result.status).toBe("signedIn");
    expect(ctx.api.calls.refresh).toBe(1);
  });

  it("clears and stays signedOut when stored refresh token is invalid", async () => {
    await ctx.store.setRefreshToken("bad");
    ctx.api.failRefresh = true;
    const result = await ctx.manager.initialize();
    expect(result.status).toBe("signedOut");
    expect(await ctx.store.getRefreshToken()).toBeNull();
  });
});

const sampleRequest: GenerateRequest = {
  prompt: "RSI strategy",
  taskType: "strategy",
  pineVersion: "v6",
  editorContext: { currentCode: "", compilerErrors: [] },
};

describe("AuthManager generate", () => {
  it("routes generation through the current access token", async () => {
    const { manager, api } = setup();
    await manager.signIn();

    const result = await manager.generate({ ...sampleRequest });

    expect(result.title).toBeTruthy();
    expect(api.calls.generate).toBe(1);
    expect(api.lastAccessToken).toBe("access-1");
  });

  it("rejects and signs out when there is no valid session", async () => {
    const { manager } = setup();
    await expect(manager.generate({ ...sampleRequest })).rejects.toThrow();
    expect(manager.getState().status).toBe("signedOut");
  });
});
