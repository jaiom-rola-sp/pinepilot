export interface HttpErrorOptions {
  /** Stable machine-readable code (e.g. "quota_exceeded") for clients. */
  code?: string;
  /** Extra response headers to emit (e.g. rate-limit headers). */
  headers?: Record<string, string>;
}

/** Error carrying an HTTP status code, understood by the global error handler. */
export class HttpError extends Error {
  public readonly code?: string;
  public readonly headers?: Record<string, string>;

  constructor(
    public readonly statusCode: number,
    message: string,
    options: HttpErrorOptions = {},
  ) {
    super(message);
    this.name = "HttpError";
    this.code = options.code;
    this.headers = options.headers;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad Request") {
    super(400, message);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

/** Model output could not be validated after retries. */
export class UnprocessableEntityError extends HttpError {
  constructor(message = "Unprocessable Entity") {
    super(422, message);
    this.name = "UnprocessableEntityError";
  }
}

/** Rate/quota limit reached. Carries a code and rate-limit headers. */
export class TooManyRequestsError extends HttpError {
  constructor(message = "Too Many Requests", options: HttpErrorOptions = {}) {
    super(429, message, options);
    this.name = "TooManyRequestsError";
  }
}

/** Upstream provider (e.g. the LLM) failed. */
export class BadGatewayError extends HttpError {
  constructor(message = "Bad Gateway") {
    super(502, message);
    this.name = "BadGatewayError";
  }
}
