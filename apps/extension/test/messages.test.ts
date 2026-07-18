import { describe, expect, it } from "vitest";
import {
  isAuthStateChangedEvent,
  isBackgroundRequest,
} from "../src/lib/messages.js";
import { INITIAL_AUTH_STATE } from "../src/lib/types.js";

describe("isBackgroundRequest", () => {
  it("accepts every known request type", () => {
    for (const type of [
      "AUTH_SIGN_IN",
      "AUTH_SIGN_OUT",
      "AUTH_GET_STATE",
      "AUTH_GET_ME",
    ]) {
      expect(isBackgroundRequest({ type })).toBe(true);
    }
  });

  it("rejects unknown or malformed messages", () => {
    expect(isBackgroundRequest({ type: "NOPE" })).toBe(false);
    expect(isBackgroundRequest({})).toBe(false);
    expect(isBackgroundRequest(null)).toBe(false);
    expect(isBackgroundRequest("AUTH_SIGN_IN")).toBe(false);
    expect(isBackgroundRequest({ type: 123 })).toBe(false);
  });
});

describe("isAuthStateChangedEvent", () => {
  it("accepts a well-formed event", () => {
    expect(
      isAuthStateChangedEvent({
        type: "AUTH_STATE_CHANGED",
        state: INITIAL_AUTH_STATE,
      }),
    ).toBe(true);
  });

  it("rejects other messages", () => {
    expect(isAuthStateChangedEvent({ type: "AUTH_SIGN_IN" })).toBe(false);
    expect(isAuthStateChangedEvent(null)).toBe(false);
  });
});
