import { ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { Role } from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   options: null as null | Record<string, (input: never) => unknown>,
   toast: vi.fn(),
}));

vi.mock("@/lib/hooks/mutations/useApiMutation", async (original) => ({
   ...(await original<typeof import("@/lib/hooks/mutations/useApiMutation")>()),
   default: (options: typeof h.options) => {
      h.options = options;
      return {};
   },
}));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { error: h.toast, success: vi.fn() },
}));

import useRemoveBucket from "../bucket/useRemoveBucket";
import useAcceptInvite from "./useAcceptInvite";
import useRemoveMember from "./useRemoveMember";
import useRevokeInvite from "./useRevokeInvite";
import useUpdateRole from "./useUpdateRole";

const scope = { userId: "me", serverId: "server" };
const queryClient = () => ({ invalidateQueries: vi.fn(async () => {}) });

const fail = (
   error: ApiError,
   variables: Record<string, unknown>,
   client = queryClient()
) => {
   (h.options!.failure as (input: unknown) => void)({
      error,
      variables,
      scope,
      queryClient: client,
   });
   return client;
};

const invalidated = (variables: unknown): readonly unknown[][] =>
   (h.options!.invalidates as (input: unknown) => readonly unknown[][])({
      data: undefined,
      variables,
      scope,
   });

const SENT_INVITES = [queryKeys.sentInvites("me", "server")];

beforeEach(() => {
   h.options = null;
   h.toast.mockReset();
});

describe("refreshing pending invites the API may have revoked", () => {
   it("after removing a member", () => {
      useRemoveMember();
      expect(invalidated({ serverId: "server", userId: "member" })).toEqual([
         queryKeys.members("me", "server"),
         ...SENT_INVITES,
      ]);
   });

   it("after changing a member's role or access", () => {
      useUpdateRole();
      expect(
         invalidated({
            serverId: "server",
            userId: "member",
            role: Role.VIEWER,
         })
      ).toEqual([queryKeys.members("me", "server"), ...SENT_INVITES]);
   });

   it("after removing a bucket", () => {
      useRemoveBucket();
      expect(invalidated("backups")).toEqual([
         queryKeys.buckets("me", "server"),
         ...SENT_INVITES,
         queryKeys.members("me", "server"),
      ]);
   });
});

describe("revoking an invite", () => {
   it("reloads the lists when the invite is already gone", () => {
      useRevokeInvite();
      const client = fail(new ApiError(404, "Invite not found"), {
         serverId: "server",
         inviteId: "invite",
      });
      expect(h.toast).toHaveBeenCalledExactlyOnceWith(
         "Couldn't revoke the invite",
         { description: "Invite not found" }
      );
      for (const queryKey of SENT_INVITES)
         expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey });
   });

   it("only explains other failures", () => {
      useRevokeInvite();
      const client = fail(new ApiError(500, "Boom"), {
         serverId: "server",
         inviteId: "invite",
      });
      expect(h.toast).toHaveBeenCalledOnce();
      expect(client.invalidateQueries).not.toHaveBeenCalled();
   });
});

describe("changing a member's role from the table", () => {
   const ADMIN_LIMITED =
      "Their access to site is limited to folders. Give them the whole bucket before making them an admin.";

   it("shows the API's reason and reloads the members", () => {
      useUpdateRole();
      const client = fail(new ApiError(409, ADMIN_LIMITED), {
         serverId: "server",
         userId: "member",
         role: Role.ADMIN,
      });
      expect(h.toast).toHaveBeenCalledExactlyOnceWith(
         "Couldn't update access",
         { description: ADMIN_LIMITED }
      );
      expect(client.invalidateQueries).toHaveBeenCalledWith({
         queryKey: queryKeys.members("me", "server"),
      });
   });
});

describe("saving a member's bucket access", () => {
   it("leaves a conflict to the dialog, which explains it in place", () => {
      useUpdateRole();
      const client = fail(new ApiError(409, "Changed meanwhile."), {
         serverId: "server",
         userId: "member",
         role: Role.EDITOR,
         bucketAccess: [],
         previousBucketAccess: [],
      });
      expect(h.toast).not.toHaveBeenCalled();
      expect(client.invalidateQueries).toHaveBeenCalledWith({
         queryKey: queryKeys.members("me", "server"),
      });
   });

   it("toasts anything else", () => {
      useUpdateRole();
      const client = fail(
         new ApiError(400, "Admins can't be limited to folders"),
         {
            serverId: "server",
            userId: "member",
            role: Role.ADMIN,
            bucketAccess: [],
         }
      );
      expect(h.toast).toHaveBeenCalledOnce();
      expect(client.invalidateQueries).not.toHaveBeenCalled();
   });
});

describe("accepting an invite", () => {
   it("reloads everything about that server, since access may have merged", () => {
      useAcceptInvite();
      const keys = (
         h.options!.invalidates as (input: unknown) => readonly unknown[][]
      )({ data: { id: "joined", name: "Joined" }, scope });
      expect(keys).toEqual([
         queryKeys.receivedInvites("me"),
         queryKeys.servers("me"),
         queryKeys.server("me", "joined"),
      ]);
   });

   it("shows why an invite couldn't be accepted", () => {
      useAcceptInvite();
      const message =
         "This invite makes you an admin, but your access to site is limited to folders. Ask the server owner to update your access first.";
      const client = fail(new ApiError(409, message), { inviteId: "i" });
      expect(h.toast).toHaveBeenCalledExactlyOnceWith(
         "Couldn't accept the invite",
         { description: message }
      );
      expect(client.invalidateQueries).toHaveBeenCalledWith({
         queryKey: queryKeys.receivedInvites("me"),
      });
   });
});
