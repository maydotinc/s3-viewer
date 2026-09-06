import { z } from "zod";
import { emailSchema, idSchema } from "./primitives";

// The account shown in the confirmation dialog must be the account deleted,
// even when another tab changes the browser's session cookie in the meantime.
export const deleteAccountSchema = z.object({
   expectedUserId: idSchema,
   confirmedEmail: emailSchema,
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
