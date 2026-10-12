// @vitest-environment happy-dom
import { act, createElement, type FormEvent, type ReactNode } from "react";
import { mountRuntime } from "@/lib/test/runtime";
import {
   MAX_BUCKET_NAMES,
   Role,
   type S3Bucket,
   type SendInviteInput,
} from "@s3-viewer/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GrantRow } from "./bucket-grants";
import InviteDialog from "./invite-dialog";

type PickerProps = {
   value: GrantRow[];
   onChange: (rows: GrantRow[]) => void;
   error?: string | null;
   showErrors?: boolean;
   serverRole?: Role;
};
const h = vi.hoisted(() => ({
   send: vi.fn(),
   warning: vi.fn(),
   picker: undefined as PickerProps | undefined,
   serverRole: undefined as { onChange: (role: Role) => void } | undefined,
}));

vi.mock("@/components/Modals/form-dialog", () => ({
   FormDialog: (props: {
      onSubmit: (event: FormEvent) => void;
      submitDisabled?: boolean;
      children?: ReactNode;
   }) =>
      createElement(
         "form",
         { onSubmit: props.onSubmit },
         props.children,
         createElement(
            "button",
            { type: "submit", disabled: props.submitDisabled },
            "Send"
         )
      ),
}));
vi.mock("@/lib/hooks/mutations/invites/useSendInvite", () => ({
   default: () => ({ mutate: h.send, isPending: false, error: null }),
}));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock({ warning: h.warning })
);
vi.mock("@/lib/hooks/queries/useInstanceConfig", () => ({
   default: () => ({}),
   emailState: () => "enabled",
}));
vi.mock("@/components/Settings/unverified-callout", () => ({
   default: () => null,
}));
vi.mock("./bucket-access-picker", () => ({
   default: (props: PickerProps) => {
      h.picker = props;
      return null;
   },
}));
vi.mock("./role-select", () => ({
   default: (props: { onChange: (role: Role) => void }) => {
      h.serverRole = props;
      return null;
   },
}));

const buckets: S3Bucket[] = ["site", "docs"].map((name) => ({
   name,
   creationDate: null,
   userRole: Role.OWNER,
   folders: null,
}));

let runtime: Awaited<ReturnType<typeof mountRuntime>>;
const picker = () => h.picker!;
const choose = (rows: GrantRow[]) => act(async () => picker().onChange(rows));
const serverRole = (role: Role) =>
   act(async () => h.serverRole!.onChange(role));
const submit = () =>
   act(async () => {
      runtime.container
         .querySelector("form")!
         .dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
         );
   });
const submitDisabled = () =>
   runtime.container.querySelector<HTMLButtonElement>("button[type=submit]")!
      .disabled;
const sent = (): SendInviteInput["bucketAccess"] | undefined =>
   (h.send.mock.calls.at(-1)?.[0] as SendInviteInput | undefined)?.bucketAccess;

const row = (
   bucketName: string,
   role: Role,
   folders: string[] | null,
   draft?: string
): GrantRow => ({ bucketName, role, folders, draft });

beforeEach(async () => {
   vi.clearAllMocks();
   runtime = await mountRuntime(
      createElement(InviteDialog, {
         serverId: "server",
         myRole: Role.OWNER,
         buckets,
         isBucketsLoading: false,
         onClose: vi.fn(),
      })
   );
   await act(async () => {
      const emails = runtime.container.querySelector<HTMLInputElement>(
         'input[inputmode="email"]'
      )!;
      Object.getOwnPropertyDescriptor(
         HTMLInputElement.prototype,
         "value"
      )!.set!.call(emails, "a@example.com");
      emails.dispatchEvent(new Event("input", { bubbles: true }));
   });
});
afterEach(async () => {
   await runtime.unmount();
   runtime.queryClient.clear();
   vi.unstubAllGlobals();
});

describe("what an invite sends", () => {
   it("always sends folders: null for a whole bucket, the list otherwise", async () => {
      await choose([
         row("site", Role.EDITOR, ["landing/"]),
         row("docs", Role.VIEWER, null),
      ]);
      await submit();
      expect(sent()).toEqual([
         { bucketName: "site", role: Role.EDITOR, folders: ["landing/"] },
         { bucketName: "docs", role: Role.VIEWER, folders: null },
      ]);
   });

   it("adds a folder that was typed but not added", async () => {
      await choose([row("site", Role.EDITOR, [], "landing")]);
      await submit();
      expect(sent()).toEqual([
         { bucketName: "site", role: Role.EDITOR, folders: ["landing/"] },
      ]);
   });

   it("keeps a second typed folder instead of dropping it", async () => {
      await choose([row("site", Role.EDITOR, ["landing/"], "blog/")]);
      await submit();
      expect(sent()?.[0]?.folders).toEqual(["blog/", "landing/"]);
   });

   it("holds the invite and says why when a typed folder can't go in", async () => {
      await choose([row("site", Role.EDITOR, ["landing/"], "x/../y")]);
      await submit();
      expect(h.send).not.toHaveBeenCalled();
      expect(picker().error).toBe("Check the access on site.");
      expect(picker().showErrors).toBe(true);
      expect(picker().value[0]?.draft).toBe("x/../y");
   });

   it("never sends an empty folder list", async () => {
      await choose([row("site", Role.EDITOR, [])]);
      await submit();
      expect(h.send).not.toHaveBeenCalled();
   });

   it("sends whole buckets for an admin bucket role", async () => {
      await choose([row("site", Role.ADMIN, null)]);
      await submit();
      expect(sent()).toEqual([
         { bucketName: "site", role: Role.ADMIN, folders: null },
      ]);
   });
});

describe("granting more buckets than the API accepts", () => {
   const many = Array.from({ length: MAX_BUCKET_NAMES + 1 }, (_unused, index) =>
      row(`bucket-${index}`, Role.VIEWER, null)
   );

   it("says so before sending, and holds the invite", async () => {
      await choose(many);
      expect(picker().error).toBe(`Choose at most ${MAX_BUCKET_NAMES} buckets`);
      expect(submitDisabled()).toBe(true);
      await submit();
      expect(h.send).not.toHaveBeenCalled();
   });

   it("sends once enough are cleared", async () => {
      await choose(many.slice(0, MAX_BUCKET_NAMES));
      expect(picker().error).toBeNull();
      expect(submitDisabled()).toBe(false);
   });
});

describe("inviting an admin", () => {
   it("tells the picker so rows can't be limited", async () => {
      await serverRole(Role.ADMIN);
      expect(picker().serverRole).toBe(Role.ADMIN);
   });

   it("won't widen rows that were already limited, and won't send them", async () => {
      const limited = row("site", Role.EDITOR, ["landing/"]);
      await choose([limited]);
      await serverRole(Role.ADMIN);
      expect(picker().value).toEqual([limited]);
      await submit();
      expect(h.send).not.toHaveBeenCalled();
      expect(picker().error).toBe(
         "Admins can't be limited to folders. Choose Whole bucket on site, or a different server role."
      );
      expect(picker().value).toEqual([limited]);
   });

   it("sends whole buckets once they're chosen", async () => {
      await serverRole(Role.ADMIN);
      await choose([row("site", Role.EDITOR, null)]);
      await submit();
      expect(h.send).toHaveBeenCalledOnce();
      expect(h.send.mock.calls[0]?.[0]).toMatchObject({
         role: Role.ADMIN,
         bucketAccess: [
            { bucketName: "site", role: Role.EDITOR, folders: null },
         ],
      });
   });
});

describe("after the invite is saved", () => {
   const succeed = async (emailed: boolean[]) => {
      await choose([row("site", Role.VIEWER, null)]);
      await submit();
      const options = h.send.mock.calls.at(-1)?.[1] as {
         onSuccess: (result: {
            invites: { email: string; emailed: boolean }[];
         }) => void;
      };
      await act(async () =>
         options.onSuccess({
            invites: emailed.map((sent, index) => ({
               email: `person${index}@example.com`,
               emailed: sent,
            })),
         })
      );
   };

   it("says nothing extra when every email went out", async () => {
      await succeed([true]);
      expect(h.warning).not.toHaveBeenCalled();
   });

   it("names the address whose email wasn't sent", async () => {
      await succeed([false]);
      expect(h.warning).toHaveBeenCalledWith(
         "Invite saved, but no email went to person0@example.com",
         expect.objectContaining({
            description: expect.stringContaining("that address"),
         })
      );
   });

   it("counts several invites that weren't emailed", async () => {
      await succeed([false, true, false]);
      expect(h.warning).toHaveBeenCalledWith(
         "2 invites saved, but their emails weren't sent",
         expect.anything()
      );
   });
});
