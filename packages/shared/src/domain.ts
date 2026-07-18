import { z } from "zod";

/**
 * Supported Pine Script versions.
 * MVP targets v6 only; kept as an enum so additional versions can be added
 * without changing consumers.
 */
export const PineVersionSchema = z.enum(["v6"]);
export type PineVersion = z.infer<typeof PineVersionSchema>;

/** Kind of Pine Script artifact a generation targets. */
export const TaskTypeSchema = z.enum(["indicator", "strategy"]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

/** Subscription tiers from the PRD pricing concept. */
export const PlanSchema = z.enum(["free", "pro", "team"]);
export type Plan = z.infer<typeof PlanSchema>;

/**
 * Compile status of a generation once the user has run it in TradingView.
 * `unknown` is the default until we observe a real compile result.
 */
export const CompileStatusSchema = z.enum(["unknown", "success", "error"]);
export type CompileStatus = z.infer<typeof CompileStatusSchema>;

/** Feedback rating on a generation (thumbs up/down). */
export const FeedbackRatingSchema = z.enum(["up", "down"]);
export type FeedbackRating = z.infer<typeof FeedbackRatingSchema>;
