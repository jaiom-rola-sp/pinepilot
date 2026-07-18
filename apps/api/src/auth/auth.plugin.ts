import fp from "fastify-plugin";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";
import type { TokenService } from "./token.service.js";
import { TokenError } from "./token.service.js";
import { UnauthorizedError } from "./errors.js";

/** Authenticated principal attached to a request after `authenticate`. */
export interface AuthPrincipal {
  userId: string;
}

declare module "fastify" {
  interface FastifyInstance {
    /** preHandler that rejects requests lacking a valid Bearer access token. */
    authenticate: preHandlerHookHandler;
  }
  interface FastifyRequest {
    principal?: AuthPrincipal;
  }
}

export interface AuthPluginOptions {
  tokenService: TokenService;
}

function extractBearer(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new UnauthorizedError("Missing bearer token");
  }
  return token;
}

/**
 * Registers `app.authenticate`, a preHandler that verifies the access token and
 * attaches `request.principal`. Uses `fastify-plugin` so the decorator is
 * available to sibling route plugins (no encapsulation boundary).
 */
export const authPlugin = fp(
  async (app: FastifyInstance, opts: AuthPluginOptions) => {
    const { tokenService } = opts;

    app.decorate(
      "authenticate",
      async (request: FastifyRequest, _reply: FastifyReply) => {
        const token = extractBearer(request);
        try {
          const claims = tokenService.verifyAccessToken(token);
          request.principal = { userId: claims.sub };
        } catch (err) {
          if (err instanceof TokenError) {
            throw new UnauthorizedError(err.message);
          }
          throw err;
        }
      },
    );
  },
  { name: "auth-plugin" },
);
