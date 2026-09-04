type DeletedUser = { id: string; email: string; name: string };

type UserDeletionHooks = {
   beforeDelete: (user: DeletedUser) => Promise<void>;
   afterDelete: (user: DeletedUser) => Promise<void>;
};

let registered: UserDeletionHooks | null = null;

const onUserDeletion = (hooks: UserDeletionHooks): void => {
   registered = hooks;
};

// fails closed: a user row must never disappear without the api's erasure
// having run first
const userDeletionHooks: UserDeletionHooks = {
   beforeDelete: async (user) => {
      if (!registered) {
         throw new Error("No account deletion handler is registered");
      }
      await registered.beforeDelete(user);
   },
   afterDelete: async (user) => {
      await registered?.afterDelete(user);
   },
};

export { onUserDeletion, userDeletionHooks };
export type { DeletedUser, UserDeletionHooks };
