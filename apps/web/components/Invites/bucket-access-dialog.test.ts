// @vitest-environment happy-dom
import { act, createElement, type FormEvent, type ReactNode } from "react";
import { mountedRuntime, submitForm } from "@/components/test-helpers";
import { ApiError } from "@/lib/api";
import {
   MAX_BUCKET_NAMES,
   Role,
   type BucketAccessEntry,
   type S3Bucket,
   type ServerUser,
   type UpdateRoleInput,
} from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BucketAccessDialog from "./bucket-access-dialog";
import type { GrantRow } from "./bucket-grants";

type Callbacks = { onSuccess: () => void; onError: (error: ApiError) => void };
type PickerProps = {
   value: GrantRow[];
   onChange: (rows: GrantRow[]) => void;
   original?: BucketAccessEntry[];
   serverRole?: Role;
   error?: string | null;
   disabled?: boolean;
};
const h = vi.hoisted(() => ({
   update: vi.fn(),
   close: vi.fn(),
   picker: undefined as PickerProps | undefined,
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
            "Save"
         )
      ),
}));
vi.mock("@/lib/hooks/mutations/invites/useUpdateRole", () => ({
   default: () => ({ mutate: h.update, isPending: false }),
}));
vi.mock("./bucket-access-picker", () => ({
   default: (props: PickerProps) => {
      h.picker = props;
      return null;
   },
}));

const buckets: S3Bucket[] = ["site", "docs"].map((name) => ({
   name,
   creationDate: null,
   userRole: Role.OWNER,
   folders: null,
}));

const LOADED = [
   { bucketName: "site", role: Role.EDITOR, folders: ["landing/"] },
   { bucketName: "docs", role: Role.VIEWER, folders: null },
];

const member = (role = Role.EDITOR, bucketAccess = LOADED): ServerUser => ({
   id: "member",
   name: "Sam",
   email: "sam@example.com",
   role,
   bucketAccess,
});

const view = mountedRuntime();
const picker = () => h.picker!;
const choose = (rows: GrantRow[]) => act(async () => picker().onChange(rows));
const submit = () =>
   act(async () => {
      submitForm(view.current.container);
   });
const submitDisabled = () =>
   view.current.container.querySelector<HTMLButtonElement>(
      "button[type=submit]"
   )!.disabled;
const sent = () => h.update.mock.calls.at(-1)?.[0] as UpdateRoleInput;
const fail = (error: ApiError) =>
   act(async () =>
      (h.update.mock.calls.at(-1)?.[1] as Callbacks).onError(error)
   );

const open = async (who = member()) => {
   await view.mount(
      createElement(BucketAccessDialog, {
         serverId: "server",
         myRole: Role.OWNER,
         buckets,
         isBucketsLoading: false,
         member: who,
         onClose: h.close,
      })
   );
};

beforeEach(() => vi.clearAllMocks());

describe("saving a member's access", () => {
   it("sends the new access with the access the editor opened with", async () => {
      await open();
      await choose([
         { bucketName: "site", role: Role.EDITOR, folders: ["a/", "landing/"] },
         { bucketName: "docs", role: Role.VIEWER, folders: null },
      ]);
      await submit();
      expect(sent()).toEqual({
         serverId: "server",
         userId: "member",
         role: Role.EDITOR,
         bucketAccess: [
            {
               bucketName: "site",
               role: Role.EDITOR,
               folders: ["a/", "landing/"],
            },
            { bucketName: "docs", role: Role.VIEWER, folders: null },
         ],
         previousBucketAccess: LOADED,
      });
   });

   it("can save a folder that was only typed, and sends it", async () => {
      await open();
      expect(submitDisabled()).toBe(true);
      await choose([{ ...LOADED[0]!, draft: "blog" }, LOADED[1]!]);
      expect(submitDisabled()).toBe(false);
      await submit();
      expect(sent().bucketAccess?.[0]?.folders).toEqual(["blog/", "landing/"]);
   });

   it("explains instead of saving when the typed folder can't go in", async () => {
      await open();
      await choose([{ ...LOADED[0]!, draft: "a/./b" }, LOADED[1]!]);
      await submit();
      expect(h.update).not.toHaveBeenCalled();
      expect(picker().error).toBe("Check the access on site.");
   });
});

describe("granting more buckets than the API accepts", () => {
   it("explains the limit instead of saving", async () => {
      await open();
      await choose(
         Array.from({ length: MAX_BUCKET_NAMES + 1 }, (_unused, index) => ({
            bucketName: `bucket-${index}`,
            role: Role.VIEWER,
            folders: null,
         }))
      );
      await submit();
      expect(h.update).not.toHaveBeenCalled();
      expect(picker().error).toBe(`Choose at most ${MAX_BUCKET_NAMES} buckets`);
   });
});

describe("someone else changed the access meanwhile", () => {
   const MESSAGE =
      "This member's access changed while you were editing it. Reopen it and try again.";

   it("shows the reason in place and stops saving the stale copy", async () => {
      await open();
      await choose([LOADED[0]!, { ...LOADED[1]!, role: Role.EDITOR }]);
      await submit();
      await fail(new ApiError(409, MESSAGE));
      expect(picker().error).toBe(MESSAGE);
      expect(submitDisabled()).toBe(true);
      expect(picker().disabled).toBe(true);
      expect(h.close).not.toHaveBeenCalled();
   });

   it("leaves other failures to the toast", async () => {
      await open();
      await choose([LOADED[0]!, { ...LOADED[1]!, role: Role.EDITOR }]);
      await submit();
      await fail(new ApiError(500, "Storage is down"));
      expect(submitDisabled()).toBe(false);
   });
});

describe("a member whose server role is admin", () => {
   it("won't save folders for them", async () => {
      await open(member(Role.ADMIN, [LOADED[1]!]));
      await choose([LOADED[1]!, { ...LOADED[0]! }]);
      await submit();
      expect(h.update).not.toHaveBeenCalled();
      expect(picker().error).toBe(
         "Admins can't be limited to folders. Choose Whole bucket on site, or a different server role."
      );
   });
});
