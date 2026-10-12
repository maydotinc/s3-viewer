import { z } from "zod";

const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export const pageSchema = z.object({
   cursor: z.string().min(1).max(256).optional(),
   limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .default(DEFAULT_PAGE_SIZE),
});
export type PageInput = z.infer<typeof pageSchema>;
