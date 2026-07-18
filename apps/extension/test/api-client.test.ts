import { describe, expect, it, vi } from "vitest";
import type { GenerateRequest } from "@pinepilot/shared";
import { ApiClient, ApiError } from "../src/lib/api-client.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const backendAuth = {
  accessToken: "at",
  refreshToken: "rt",
  expiresIn: 900,
  tokenType: "Bearer",
  user: { id: "u1", email: "a@b.com", plan: "free", status: "active" },
};

describe("ApiClient.loginWithGoogle", () => {
  it("posts the id token and maps the response", async () => {
    const fetchFn = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(backendAuth),
    );
    const client = new ApiClient({ baseUrl: "http://api.test/", fetchFn });

    const result = await client.loginWithGoogle("id-token");

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("http://api.test/v1/auth/google");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ idToken: "id-token" });
    expect(result.accessToken).toBe("at");
    expect(result.user).toEqual({ id: "u1", email: "a@b.com", plan: "free" });
  });
});

describe("ApiClient.refresh", () => {
  it("posts the refresh token", async () => {
    const fetchFn = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ ...backendAuth, accessToken: "at2" }),
    );
    const client = new ApiClient({ baseUrl: "http://api.test", fetchFn });

    const result = await client.refresh("my-refresh");

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("http://api.test/v1/auth/refresh");
    expect(JSON.parse(init?.body as string)).toEqual({
      refreshToken: "my-refresh",
    });
    expect(result.accessToken).toBe("at2");
  });
});

describe("ApiClient.getMe", () => {
  it("sends a bearer token and returns the user", async () => {
    const fetchFn = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ id: "u1", email: "a@b.com", plan: "pro" }),
    );
    const client = new ApiClient({ baseUrl: "http://api.test", fetchFn });

    const user = await client.getMe("access-token");

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("http://api.test/v1/me");
    expect(init?.method).toBe("GET");
    expect((init?.headers as Record<string, string>).authorization).toBe(
      "Bearer access-token",
    );
    expect(user.plan).toBe("pro");
  });

  it("throws ApiError with status and message on failure", async () => {
    const fetchFn = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(
          { error: { message: "Unauthorized", statusCode: 401 } },
          401,
        ),
    );
    const client = new ApiClient({ baseUrl: "http://api.test", fetchFn });

    await expect(client.getMe("bad")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Unauthorized",
    });
    await expect(client.getMe("bad")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("ApiClient.generate", () => {
  const generatePayload = {
    title: "T",
    summary: "S",
    code: "//@version=6\nindicator('x')",
    assumptions: [],
    warnings: [],
    usage: { requestsRemaining: 10 },
  };
  const request: GenerateRequest = {
    prompt: "rsi",
    taskType: "indicator",
    pineVersion: "v6",
    editorContext: { currentCode: "", compilerErrors: [] },
  };

  it("posts the request with a bearer token and returns the result", async () => {
    const fetchFn = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(generatePayload),
    );
    const client = new ApiClient({ baseUrl: "http://api.test", fetchFn });

    const result = await client.generate("access-token", request);

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("http://api.test/v1/generate");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).authorization).toBe(
      "Bearer access-token",
    );
    expect(JSON.parse(init?.body as string)).toEqual(request);
    expect(result.code).toContain("@version=6");
  });

  it("maps quota responses to an ApiError flagged as quota", async () => {
    const fetchFn = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(
          { error: { message: "Quota exceeded", statusCode: 429 } },
          429,
        ),
    );
    const client = new ApiClient({ baseUrl: "http://api.test", fetchFn });

    await expect(client.generate("t", request)).rejects.toMatchObject({
      status: 429,
    });
    const err = await client.generate("t", request).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).isQuota).toBe(true);
  });
});
