import { describe, expect, it, vi } from "vitest";
import { onUserDeletion, userDeletionHooks } from "./user-deletion";

const user = { id: "user_1", email: "ada@example.com", name: "Ada" };

describe("userDeletionHooks", () => {
   it("refuses to run before a handler is registered", async () => {
      await expect(userDeletionHooks.beforeDelete(user)).rejects.toThrow(
         /No account deletion handler/
      );
      await expect(
         userDeletionHooks.afterDelete(user)
      ).resolves.toBeUndefined();
   });

   it("forwards both hooks to the registered handler", async () => {
      const hooks = {
         beforeDelete: vi.fn().mockResolvedValue(undefined),
         afterDelete: vi.fn().mockResolvedValue(undefined),
      };
      onUserDeletion(hooks);
      await userDeletionHooks.beforeDelete(user);
      await userDeletionHooks.afterDelete(user);
      expect(hooks.beforeDelete).toHaveBeenCalledWith(user);
      expect(hooks.afterDelete).toHaveBeenCalledWith(user);
   });
});
