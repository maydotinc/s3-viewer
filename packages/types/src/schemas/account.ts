import { z } from "zod";
import { PASSWORD_MAX_LENGTH } from "../constants";
import { emailSchema, expectedUserShape } from "./primitives";

// no password minimum: this verifies an existing secret.
export const deleteAccountSchema = z.object({
   ...expectedUserShape,
   confirmedEmail: emailSchema,
   password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
   acknowledgeSharedServers: z.boolean().optional(),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
