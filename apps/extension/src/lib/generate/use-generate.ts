import { useCallback, useState } from "react";
import type { GenerateRequest, GenerateResponse } from "@pinepilot/shared";
import { BackgroundRequestError } from "../messaging-client.js";

export type GenerateView =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: GenerateResponse }
  | { status: "error"; message: string }
  | { status: "quota"; message: string };

export type GenerateFn = (
  request: GenerateRequest,
) => Promise<GenerateResponse>;

export interface UseGenerate {
  view: GenerateView;
  run: (request: GenerateRequest) => Promise<void>;
  reset: () => void;
}

const QUOTA_MESSAGE =
  "You've reached your generation limit. Upgrade your plan to continue.";
const SESSION_MESSAGE = "Your session expired. Please sign in again.";

/**
 * Explicit UI state machine for a generation:
 * idle -> loading -> (success | error | quota).
 * Provider/transport concerns are handled upstream (background worker); this
 * hook only maps outcomes to view states.
 */
export function useGenerate(onGenerate: GenerateFn): UseGenerate {
  const [view, setView] = useState<GenerateView>({ status: "idle" });

  const run = useCallback(
    async (request: GenerateRequest) => {
      setView({ status: "loading" });
      try {
        const result = await onGenerate(request);
        setView({ status: "success", result });
      } catch (err) {
        if (err instanceof BackgroundRequestError) {
          if (err.isQuota) {
            setView({ status: "quota", message: QUOTA_MESSAGE });
            return;
          }
          if (err.isUnauthorized) {
            setView({ status: "error", message: SESSION_MESSAGE });
            return;
          }
        }
        setView({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Generation failed. Try again.",
        });
      }
    },
    [onGenerate],
  );

  const reset = useCallback(() => setView({ status: "idle" }), []);

  return { view, run, reset };
}
