// @vitest-environment happy-dom
import { buttonByText, mountedRuntime } from "@/components/test-helpers";
import { Role, type ServerUser } from "@s3-viewer/types";
import { act, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ remove: vi.fn() }));

vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "owner" }));
vi.mock("@/lib/hooks/mutations/invites/useUpdateRole", () => ({
   default: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("@/lib/hooks/mutations/invites/useRemoveMember", () => ({
   default: () => ({ isPending: false, mutate: h.remove }),
}));
vi.mock("@s3-viewer/ui/components/tooltip", () => ({
   SimpleTooltip: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/Modals/confirm-dialog", () => ({
   ConfirmDialog: (props: {
      confirmVariant?: string;
      confirmLabel: string;
      onConfirm: () => void;
      onClose: () => void;
   }) =>
      createElement(
         "div",
         { role: "dialog", "data-variant": props.confirmVariant },
         createElement(
            "button",
            { onClick: props.onConfirm },
            props.confirmLabel
         ),
         createElement("button", { onClick: props.onClose }, "Cancel")
      ),
}));
vi.mock("@/components/Invites/bucket-access-dialog", () => ({
   default: () => null,
}));
vi.mock("@/components/Invites/role-select", () => ({
   default: ({ roles }: { roles: Role[] }) =>
      createElement("span", { "data-roles": roles.join(" ") }),
}));
import Members from "./members";

const member = (
   id: string,
   role: Role,
   overrides: Partial<ServerUser> = {}
): ServerUser => ({
   id,
   name: `Person ${id}`,
   email: `${id}@example.test`,
   role,
   bucketAccess: [],
   canRemove: role !== Role.OWNER,
   ...overrides,
});

const props = ({
   members,
   error = null,
   hasNextPage = false,
}: {
   members: ServerUser[];
   error?: string | null;
   hasNextPage?: boolean;
}) => ({
   serverId: "server",
   myRole: Role.OWNER,
   buckets: [],
   isBucketsLoading: false,
   members,
   isLoading: false,
   pages: {
      hasNextPage,
      error: error === null ? null : new Error(error),
      isFetching: false,
      isFetchNextPageError: error !== null,
      fetchNextPage: async () => {},
      refetch: async () => {},
   },
});

describe("the members table", () => {
   const render = (options: { error: string | null; hasNextPage: boolean }) =>
      renderToStaticMarkup(
         createElement(
            Members,
            props({
               members: [member("owner", Role.OWNER), member("a", Role.EDITOR)],
               ...options,
            })
         )
      );

   it("keeps the loaded members when the next page fails, with a way to try again", () => {
      const html = render({ error: "Network error", hasNextPage: true });
      expect(html).toContain("a@example.test");
      expect(html).toContain('role="alert"');
      expect(html).toContain("Network error");
      expect(html).toContain("Try again");
   });

   it("shows no footer once everything has loaded", () => {
      const html = render({ error: null, hasNextPage: false });
      expect(html).toContain("a@example.test");
      expect(html).not.toContain("Load more");
      expect(html).not.toContain('role="alert"');
   });
});

describe("member rows", () => {
   const render = (members: ServerUser[]) =>
      renderToStaticMarkup(createElement(Members, props({ members })));

   it("offer removal only where the API says it would succeed", () => {
      const html = render([
         member("a", Role.EDITOR),
         member("b", Role.EDITOR, { canRemove: false }),
      ]);
      expect(html).toContain('aria-label="Remove Person a"');
      expect(html).not.toContain('aria-label="Remove Person b"');
   });

   it("don't offer Admin to a member limited to folders", () => {
      const html = render([
         member("a", Role.EDITOR, {
            bucketAccess: [
               { bucketName: "site", role: Role.EDITOR, folders: ["docs/"] },
            ],
         }),
      ]);
      expect(html).toContain('data-roles="VIEWER EDITOR"');
   });
});

describe("removing a member", () => {
   const view = mountedRuntime();
   const dialog = () =>
      view.current.container.querySelector<HTMLElement>("[role=dialog]");
   const click = (button: HTMLButtonElement | null | undefined) =>
      act(async () => button!.click());
   const button = (text: string) => buttonByText(view.current.container, text);

   beforeEach(async () => {
      vi.clearAllMocks();
      await view.mount(
         createElement(Members, props({ members: [member("a", Role.EDITOR)] }))
      );
      await click(
         view.current.container.querySelector<HTMLButtonElement>(
            'button[aria-label="Remove Person a"]'
         )
      );
   });

   it("asks first instead of removing on the first click", () => {
      expect(h.remove).not.toHaveBeenCalled();
      expect(dialog()?.dataset.variant).toBe("destructive");
   });

   it("removes them once confirmed, and closes when that succeeds", async () => {
      await click(button("Remove"));
      expect(h.remove).toHaveBeenCalledOnce();
      const [variables, options] = h.remove.mock.calls[0] as [
         unknown,
         { onSuccess: () => void },
      ];
      expect(variables).toEqual({ serverId: "server", userId: "a" });
      await act(async () => options.onSuccess());
      expect(dialog()).toBeNull();
   });

   it("keeps them when cancelled", async () => {
      await click(button("Cancel"));
      expect(dialog()).toBeNull();
      expect(h.remove).not.toHaveBeenCalled();
   });
});
