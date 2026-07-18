/** Error carrying an HTTP status code, understood by the global error handler. */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
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

/** Upstream provider (e.g. the LLM) failed. */
export class BadGatewayError extends HttpError {
  constructor(message = "Bad Gateway") {
    super(502, message);
    this.name = "BadGatewayError";
  }
}
