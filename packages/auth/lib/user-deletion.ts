import { APIError } from "better-auth/api";
import { SHARED_SERVERS_CODE } from "./errors";

type DeletedUser = {
   id: string;
   email: string;
   name: string;
   emailVerified: boolean;
};

type UserDeletionHooks = {
   // names of owned servers other people use; deleting the owner cascades them away.
   sharedServerNames: (userId: string) => Promise<string[]>;
   beforeDelete: (user: DeletedUser) => Promise<void>;
   afterDelete: (user: DeletedUser) => Promise<void>;
};

let registered: UserDeletionHooks | null = null;

const onUserDeletion = (hooks: UserDeletionHooks): void => {
   registered = hooks;
};

const requireRegistered = (): UserDeletionHooks => {
   if (!registered) {
      throw new Error("No account deletion handler is registered");
   }
   return registered;
};

const userDeletionHooks: Pick<
   UserDeletionHooks,
   "beforeDelete" | "afterDelete"
> = {
   beforeDelete: async (user) => {
      await requireRegistered().beforeDelete(user);
   },
   afterDelete: async (user) => {
      await registered?.afterDelete(user);
   },
};

const NAMES_SHOWN = 3;

const listNames = (names: readonly string[]): string => {
   const shown = names.slice(0, NAMES_SHOWN).map((name) => `"${name}"`);
   const rest = names.length - shown.length;
   return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ");
};

const assertSharedServersAcknowledged = async (
   userId: string,
   acknowledged: boolean
): Promise<void> => {
   if (acknowledged) return;
   const names = await requireRegistered().sharedServerNames(userId);
   if (names.length === 0) return;
   throw new APIError("CONFLICT", {
      message: `Deleting your account also deletes ${listNames(names)} for every member. Confirm that to continue.`,
      code: SHARED_SERVERS_CODE,
   });
};

export { assertSharedServersAcknowledged, onUserDeletion, userDeletionHooks };
export type { DeletedUser, UserDeletionHooks };
