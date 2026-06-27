import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ArgumentMetadata } from "@nestjs/common";
import type { ZodSchema } from "zod";

/** Run untrusted input through a Zod schema; rethrow validation failures as 400. */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T {
    // When bound at the method level (`@UsePipes(new ZodPipe(BodySchema))`),
    // Nest can run this pipe over every handler argument. Custom param
    // decorators (`@CurrentUser()`) carry no schema-relevant data, so never
    // validate them against a body/query schema. We intentionally still
    // validate `body`, `query`, and `param` so param-level usage like
    // `@Query(new ZodPipe(QuerySchema))` keeps working.
    if (metadata?.type === "custom") return value as T;

    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: parsed.error.issues,
      });
    }
    return parsed.data;
  }
}
