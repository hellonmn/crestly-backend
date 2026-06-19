import { z, type ZodErrorMap } from "zod";

/* ============================================================
   Globally replace Zod's developer-y default error messages with
   plain-English ones the user can act on.

   Installed once from main.tsx (`installFriendlyZod()`), so every
   form across the app — students, admissions, vouchers, etc. —
   inherits the friendlier copy without per-page changes.

   Examples it fixes:
     "Expected number, received nan"  → "Must be a number"
     "Expected string, received null" → "Required"
     "String must contain at least 1 character(s)" → "Required"
     "Invalid email"                  → "Enter a valid email address"
     "Number must be greater than 0"  → "Must be greater than zero"
   ============================================================ */

const friendlyErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type: {
      // Empty inputs commonly arrive as undefined / NaN — surface those as "Required"
      // rather than the developer-facing "Expected X, received Y" string.
      if (issue.received === "undefined" || issue.received === "nan" || issue.received === "null") {
        if (issue.expected === "number") return { message: "Must be a number" };
        if (issue.expected === "string") return { message: "Required" };
        if (issue.expected === "boolean") return { message: "Required" };
        if (issue.expected === "date") return { message: "Pick a valid date" };
        return { message: "Required" };
      }
      return { message: `Should be a ${issue.expected}` };
    }

    case z.ZodIssueCode.too_small: {
      if (issue.type === "string") {
        if (issue.minimum === 1) return { message: "Required" };
        return { message: `Must be at least ${issue.minimum} character${issue.minimum === 1 ? "" : "s"}` };
      }
      if (issue.type === "number") {
        return { message: `Must be at least ${issue.minimum}` };
      }
      if (issue.type === "array") {
        if (issue.minimum === 1) return { message: "Pick at least one." };
        return { message: `Pick at least ${issue.minimum}` };
      }
      return { message: "Too small" };
    }

    case z.ZodIssueCode.too_big: {
      if (issue.type === "string") {
        return { message: `Keep it under ${issue.maximum} characters` };
      }
      if (issue.type === "number") {
        return { message: `Must be at most ${issue.maximum}` };
      }
      return { message: "Too large" };
    }

    case z.ZodIssueCode.invalid_string: {
      const v = issue.validation;
      if (v === "email") return { message: "Enter a valid email address" };
      if (v === "url")   return { message: "Enter a valid URL" };
      if (v === "uuid")  return { message: "Not a valid ID" };
      if (v === "regex") return { message: "Format looks wrong" };
      return { message: "Invalid value" };
    }

    case z.ZodIssueCode.invalid_enum_value: {
      return { message: "Pick one of the allowed options" };
    }

    case z.ZodIssueCode.invalid_date: {
      return { message: "Pick a valid date" };
    }

    case z.ZodIssueCode.custom: {
      // If a schema author set a custom message, honour it; else say "Invalid".
      if (issue.message) return { message: issue.message };
      return { message: "Invalid value" };
    }

    default:
      // Fall back to Zod's default for codes we haven't translated yet.
      return { message: ctx.defaultError };
  }
};

/** Call once at app bootstrap (main.tsx). Idempotent — safe to re-call. */
export function installFriendlyZod() {
  z.setErrorMap(friendlyErrorMap);
}
