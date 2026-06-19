import { z } from "zod";

/**
 * Convention: Zod schemas are exported with a `Schema` suffix; the inferred
 * type keeps the clean name. This avoids a value/type name collision that
 * makes esbuild silently drop the value export in Vite's dev transform.
 *
 *   import { LoginInputSchema, type LoginInput } from "@crestly/shared";
 *   LoginInputSchema.safeParse(body);  // runtime
 *   const v: LoginInput = ...;          // static type
 */

export const LoginInputSchema = z.object({
  phone: z.string().min(10).max(20),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.number().int(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string(),
    roleSlug: z.string().nullable(),
    roleName: z.string().nullable(),
    schoolId: z.number().int(),
    schoolName: z.string(),
    permissions: z.array(z.string()),
  }),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export type CurrentUser = LoginResponse["user"];
