import { z } from "zod";

export const jwtPayloadSchema = z.object({
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  exp: z.number().optional(),
  iat: z.number().optional(),
  iss: z.string().optional(),
  jti: z.string().optional(),
  nbf: z.number().optional(),
  sub: z.string().optional(),
});

/** @knipignore - exported for future unit tests */
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
