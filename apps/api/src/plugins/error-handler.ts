import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export interface ErrorResponseBody {
  error: {
    message: string;
    statusCode: number;
  };
}

/**
 * Centralized error handler. Logs the full error server-side and returns a
 * normalized, client-safe JSON body. 5xx messages are masked in non-development
 * environments to avoid leaking internals.
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error.statusCode ?? 500;

  request.log.error({ err: error, reqId: request.id }, "request failed");

  const isServerError = statusCode >= 500;
  const maskInternal = isServerError && process.env.NODE_ENV === "production";

  const body: ErrorResponseBody = {
    error: {
      message: maskInternal ? "Internal Server Error" : error.message,
      statusCode,
    },
  };

  void reply.status(statusCode).send(body);
}
