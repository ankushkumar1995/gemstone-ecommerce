/**
 * Zod-based validation that integrates with our Result/AppError system.
 * Controllers call `parse` on untrusted input (request bodies, query params)
 * and get back either typed data or a VALIDATION_ERROR with field details.
 */

import { z } from "zod";
import { ok, fail, type Result } from "./result";
import { AppErrors } from "./errors";

export function parse<T>(schema: z.ZodType<T>, input: unknown): Result<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);

  const details = parsed.error.issues.map((i) => ({
    field: i.path.join(".") || "(root)",
    message: i.message,
  }));
  return fail(AppErrors.validation("Invalid input", details));
}

export { z };
