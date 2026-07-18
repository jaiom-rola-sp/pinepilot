import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { HttpError } from "../http-errors.js";

export interface ErrorResponseBody {
  error: {
    message: string;
    statusCode: number;
    /** Optional stable machine-readable code (e.g. "quota_exceeded"). */
    code?: string;
  };
}

/**
 * Centralized error handler. Logs the full error server-side and returns a
 * normalized, client-safe JSON body. 5xx messages are masked in non-development
 * environments to avoid leaking internals. Recognized {@link HttpError}s may
 * additionally carry a machine-readable `code` and extra response headers
 * (e.g. rate-limit headers), which are surfaced to the client.
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error.statusCode ?? 500;
  const httpError = error instanceof HttpError ? error : null;

  request.log.error({ err: error, reqId: request.id }, "request failed");

  const isServerError = statusCode >= 500;
  const maskInternal = isServerError && process.env.NODE_ENV === "production";

  if (httpError?.headers) {
    for (const [name, value] of Object.entries(httpError.headers)) {
      void reply.header(name, value);
    }
  }

  const body: ErrorResponseBody = {
    error: {
      message: maskInternal ? "Internal Server Error" : error.message,
      statusCode,
      ...(httpError?.code ? { code: httpError.code } : {}),
    },
  };

  void reply.status(statusCode).send(body);
}
