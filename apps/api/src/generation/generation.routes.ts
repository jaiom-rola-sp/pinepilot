import type { FastifyPluginAsync } from "fastify";
import { GenerateRequestSchema } from "@pinepilot/shared";
import type { GenerationService } from "./generation.service.js";
import { BadRequestError, UnauthorizedError } from "../http-errors.js";

export interface GenerationRoutesOptions {
  generationService: GenerationService;
}

export const generationRoutes: FastifyPluginAsync<
  GenerationRoutesOptions
> = async (app, opts) => {
  const { generationService } = opts;

  app.post(
    "/v1/generate",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const principal = request.principal;
      if (!principal) {
        throw new UnauthorizedError();
      }

      const parsed = GenerateRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        const message = parsed.error.issues
          .map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`)
          .join("; ");
        throw new BadRequestError(message);
      }

      const result = await generationService.generate({
        userId: principal.userId,
        request: parsed.data,
      });
      return reply.status(200).send(result);
    },
  );
};
