import { z } from "zod";
import { PASSWORD_MAX_LENGTH } from "../constants";
import { emailSchema, idSchema } from "./primitives";

// The account shown in the confirmation dialog must be the account deleted,
// even when another tab changes the browser's session cookie in the meantime.
// The password is not length-checked beyond the storable maximum: this is a
// verification of an existing secret, not a new one, and a minimum here would
// only tell a caller how short the stored password is not.
export const deleteAccountSchema = z.object({
   expectedUserId: idSchema,
   confirmedEmail: emailSchema,
   password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
