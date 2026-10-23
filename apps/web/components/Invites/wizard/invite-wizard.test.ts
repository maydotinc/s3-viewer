// @vitest-environment happy-dom
import {
   buttonByText,
   mountedRuntime,
   serverInfo,
   typeInto,
} from "@/components/test-helpers";
import { ApiError } from "@/lib/api";
import { flushRuntime } from "@/lib/test/runtime";
import {
   ErrorCode,
   Role,
   type S3Bucket,
   type SendInvitesInput,
   type SendInvitesResult,
   type ServerInfo,
} from "@s3-viewer/types";
import { act, createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GrantRow } from "../bucket-grants";
import type { ServerBuckets } from "./useServerBuckets";
import type { ServerAccess } from "./wizard-state";

type AccessProps = {
   servers: ServerInfo[];
   access: Record<string, ServerAccess>;
   onAccessChange: (
      serverId: string,
      fallback: ServerAccess,
      update: (current: ServerAccess) => ServerAccess
   ) => void;
};
type SendOptions = {
   onSuccess: (result: SendInvitesResult) => void;
   onError: (error: Error) => void;
};

const h = vi.hoisted(() => ({
   servers: {} as Record<string, unknown>,
   email: "enabled" as "enabled" | "disabled" | "loading",
   query: {} as Record<string, string>,
   buckets: {} as Record<string, S3Bucket[]>,
   send: vi.fn(),
   access: undefined as AccessProps | undefined,
}));

vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "user" }));
vi.mock("@/lib/auth", () => ({ requestSignOut: vi.fn() }));
vi.mock("@/lib/hooks/queries/server/useServers", () => ({
   default: () => h.servers,
}));
vi.mock("@/lib/hooks/queries/useInstanceConfig", () => ({
   default: () => ({}),
   emailState: () => h.email,
}));
vi.mock("@/lib/hooks/mutations/invites/useSendInvites", () => ({
   default: () => ({ mutate: h.send, isPending: false }),
}));
vi.mock("./useServerBuckets", () => ({
   default: (_userId: string, ids: string[]): ServerBuckets[] =>
      ids.map((id) => ({
         serverId: id,
         buckets: h.buckets[id] ?? [],
         isLoading: !(id in h.buckets),
         error: null,
         isFetching: false,
         refetch: () => {},
      })),
}));
vi.mock("./step-access", () => ({
   default: (props: AccessProps) => {
      h.access = props;
      return createElement(
         "div",
         { "data-access": props.servers.map(({ id }) => id).join(",") },
         props.servers.map(({ name }) => name).join(" ")
      );
   },
}));
vi.mock("@/components/Layout/Sidebar/Servers/server-logo", () => ({
   default: () => null,
}));
vi.mock("@s3-viewer/ui/components/checkbox", async () =>
   (await import("@/components/test-helpers")).checkboxButton()
);
vi.mock("next/router", () => ({
   useRouter: () => ({ isReady: true, query: h.query }),
}));
vi.mock("next/link", () => ({
   default: ({ children, href }: { children: ReactNode; href: string }) =>
      createElement("a", { href }, children),
}));

import InviteWizard from "./invite-wizard";

const backups = serverInfo({ id: "a", name: "Backups" });
const media = serverInfo({ id: "b", name: "Media", userRole: Role.ADMIN });
const readOnly = serverInfo({ id: "c", name: "Shared", userRole: Role.VIEWER });

const bucket = (name: string): S3Bucket => ({
   name,
   creationDate: null,
   userRole: Role.OWNER,
   folders: null,
});

const view = mountedRuntime();

const mount = async () => {
   await view.mount(createElement(InviteWizard));
   await flushRuntime();
   return view.current.container;
};
const stepLabels = () =>
   [...view.current.container.querySelectorAll("ol > li > *")].map(
      (item) => item.textContent?.replace(/^\d/, "") ?? ""
   );
const title = () =>
   view.current.container.querySelector("section h2")!.textContent;
const continueButton = () => buttonByText(view.current.container, "Continue")!;
const sendButton = () =>
   buttonByText(view.current.container, "Send", "prefix") ??
   buttonByText(view.current.container, "Save", "prefix")!;
const addEmail = async (email: string) => {
   const input = view.current.container.querySelector("input")!;
   await act(async () => typeInto(input, email));
   await act(async () => {
      input.dispatchEvent(
         new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            cancelable: true,
         })
      );
   });
};
const click = async (button: HTMLButtonElement | undefined) => {
   await act(async () => button!.click());
   await flushRuntime();
};
const checkServer = (name: string) => {
   const label = [...view.current.container.querySelectorAll("label")].find(
      (candidate) => candidate.textContent?.startsWith(name)
   )!;
   return click(document.getElementById(label.htmlFor) as HTMLButtonElement);
};
const setAccess = (serverId: string, role: Role, rows: GrantRow[]) =>
   act(async () =>
      h.access!.onAccessChange(
         serverId,
         { role: Role.VIEWER, rows: [] },
         (current) => ({ ...current, role: role as ServerAccess["role"], rows })
      )
   );
const sentBody = () => h.send.mock.calls.at(-1)?.[0] as SendInvitesInput;
const sentOptions = () => h.send.mock.calls.at(-1)?.[1] as SendOptions;

beforeEach(() => {
   vi.clearAllMocks();
   h.email = "enabled";
   h.query = {};
   h.access = undefined;
   h.buckets = { a: [bucket("site"), bucket("docs")], b: [bucket("media")] };
   h.servers = {
      servers: [backups, media, readOnly],
      isSessionPending: false,
      isServerListLoading: false,
      hasNextPage: false,
      serverListError: null,
      isFetching: false,
      isFetchNextPageError: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
   };
});

describe("with several servers to choose from", () => {
   it("walks Who, Where, Access and Review, then sends one target per server", async () => {
      const container = await mount();
      expect(stepLabels()).toEqual(["Who", "Where", "Access", "Review"]);
      expect(title()).toBe("Who are you inviting?");
      expect(continueButton().disabled).toBe(true);

      await addEmail("a@x.com");
      await addEmail("b@x.com");
      expect(continueButton().disabled).toBe(false);
      await click(continueButton());

      expect(title()).toBe("Which servers?");
      expect(container.textContent).toContain("Inviting a@x.com and 1 other");
      expect(container.textContent).not.toContain("Shared");
      expect(continueButton().disabled).toBe(true);
      await checkServer("Backups");
      await checkServer("Media");
      await click(continueButton());

      expect(title()).toBe("What can they access?");
      expect(container.textContent).toContain(
         "Inviting a@x.com and 1 other to 2 servers"
      );
      expect(h.access!.servers.map(({ id }) => id)).toEqual(["a", "b"]);
      expect(continueButton().disabled).toBe(true);
      await setAccess("a", Role.EDITOR, [
         { bucketName: "site", role: Role.VIEWER, folders: ["landing/"] },
      ]);
      expect(continueButton().disabled).toBe(true);
      await setAccess("b", Role.VIEWER, [
         { bucketName: "media", role: Role.VIEWER, folders: null },
      ]);
      expect(continueButton().disabled).toBe(false);
      await click(continueButton());

      expect(title()).toBe("Review and send");
      expect(container.textContent).toContain("Viewer · landing/ only");
      expect(sendButton().textContent).toBe("Send 2 invites to 2 servers");
      await click(sendButton());
      expect(sentBody()).toEqual({
         emails: ["a@x.com", "b@x.com"],
         targets: [
            {
               serverId: "a",
               role: Role.EDITOR,
               bucketAccess: [
                  {
                     bucketName: "site",
                     role: Role.VIEWER,
                     folders: ["landing/"],
                  },
               ],
            },
            {
               serverId: "b",
               role: Role.VIEWER,
               bucketAccess: [
                  { bucketName: "media", role: Role.VIEWER, folders: null },
               ],
            },
         ],
         notify: true,
      });

      await act(async () =>
         sentOptions().onSuccess({
            outcomes: [
               {
                  serverId: "a",
                  invites: [],
                  alreadyMembers: ["a@x.com", "b@x.com"],
                  error: null,
               },
               {
                  serverId: "b",
                  invites: [],
                  alreadyMembers: [],
                  error: "Too many pending invites",
               },
            ],
         })
      );
      expect(title()).toBe("Sent to 1 of 2 servers");
      expect(container.textContent).toContain(
         "a@x.com and b@x.com are already members"
      );
      expect(container.textContent).toContain("Too many pending invites");
      expect(buttonByText(container, "Invite more people")).not.toBeUndefined();
      expect(container.querySelectorAll("ol button")).toHaveLength(0);
      expect(container.querySelectorAll("ol li[aria-current]")).toHaveLength(0);
   });

   it("preselects the server named in the query", async () => {
      h.query = { server: "b" };
      const container = await mount();
      await addEmail("a@x.com");
      await click(continueButton());
      const checked = [
         ...container.querySelectorAll('[role=checkbox][aria-checked="true"]'),
      ];
      expect(checked).toHaveLength(1);
      expect(continueButton().disabled).toBe(false);
   });

   it("keeps a failed request on the review step with the reason", async () => {
      h.query = { server: "a" };
      const container = await mount();
      await addEmail("a@x.com");
      await click(continueButton());
      await click(continueButton());
      await setAccess("a", Role.VIEWER, [
         { bucketName: "site", role: Role.VIEWER, folders: null },
      ]);
      await click(continueButton());
      expect(sendButton().textContent).toBe("Send invite");
      await click(sendButton());
      await act(async () => sentOptions().onError(new Error("Rate limited")));
      expect(title()).toBe("Review and send");
      expect(container.querySelector("[role=alert]")!.textContent).toContain(
         "Couldn't send invites. Rate limited"
      );
   });

   it("asks for a fresh sign-in when the API refuses an admin invite from an old session", async () => {
      h.query = { server: "a" };
      const container = await mount();
      await addEmail("a@x.com");
      await click(continueButton());
      await click(continueButton());
      await setAccess("a", Role.VIEWER, [
         { bucketName: "site", role: Role.VIEWER, folders: null },
      ]);
      await click(continueButton());
      await click(sendButton());
      await act(async () =>
         sentOptions().onError(
            new ApiError(403, "needs a sign-in", ErrorCode.SESSION_STALE)
         )
      );
      expect(title()).toBe("Review and send");
      expect(container.textContent).toContain(
         "Sign in again to invite an admin"
      );
      expect(container.textContent).not.toContain("Couldn't send invites");
   });
});

describe("with exactly one server", () => {
   beforeEach(() => {
      h.servers = { ...h.servers, servers: [backups, readOnly] };
   });

   it("skips Where and goes straight to that server's access", async () => {
      const container = await mount();
      expect(stepLabels()).toEqual(["Who", "Access", "Review"]);
      await addEmail("a@x.com");
      await click(continueButton());
      expect(title()).toBe("What can they access?");
      expect(container.textContent).toContain("Inviting a@x.com to Backups");
      expect(h.access!.servers.map(({ id }) => id)).toEqual(["a"]);
   });

   it("says Save instead of Send when the instance has no email", async () => {
      h.email = "disabled";
      await mount();
      await addEmail("a@x.com");
      await addEmail("b@x.com");
      await addEmail("c@x.com");
      await click(continueButton());
      await setAccess("a", Role.VIEWER, [
         { bucketName: "site", role: Role.VIEWER, folders: null },
      ]);
      await click(continueButton());
      expect(sendButton().textContent).toBe("Save 3 invites");
      expect(view.current.container.textContent).toContain(
         "This instance has no email configured, so invites are saved without sending."
      );
      const toggle =
         view.current.container.querySelector<HTMLButtonElement>(
            "[role=checkbox]"
         )!;
      expect(toggle.disabled).toBe(true);
      expect(toggle.getAttribute("aria-checked")).toBe("false");
   });

   it("saves without emailing when the sender turns the toggle off", async () => {
      h.email = "enabled";
      await mount();
      await addEmail("c@x.com");
      await click(continueButton());
      await setAccess("a", Role.VIEWER, [
         { bucketName: "site", role: Role.VIEWER, folders: null },
      ]);
      await click(continueButton());
      expect(sendButton().textContent).toBe("Send invite");
      await click(
         view.current.container.querySelector<HTMLButtonElement>(
            "[role=checkbox]"
         )!
      );
      expect(sendButton().textContent).toBe("Save invite");
      await click(sendButton());
      expect(sentBody().notify).toBe(false);
      await act(async () =>
         sentOptions().onSuccess({
            outcomes: [
               {
                  serverId: "a",
                  invites: [
                     {
                        id: "i1",
                        email: "c@x.com",
                        role: Role.VIEWER,
                        expiresAt: "2099-01-01T00:00:00Z",
                        server: { id: "a", name: "Alpha" },
                        invitedBy: { name: "Me", email: "me@x.com" },
                        bucketAccess: [],
                        emailed: false,
                     },
                  ],
                  alreadyMembers: [],
                  error: null,
               },
            ],
         })
      );
      expect(view.current.container.textContent).toContain("Invites saved");
      expect(view.current.container.textContent).not.toContain(
         "no email went to"
      );
   });
});

describe("while the server list loads", () => {
   it("leaves out the step list while servers load but already takes addresses", async () => {
      h.servers = { ...h.servers, servers: [], isServerListLoading: true };
      const container = await mount();
      expect(container.querySelector("ol")).toBeNull();
      expect(container.querySelector("input")).not.toBeNull();
      expect(buttonByText(container, "Cancel", "exact")).toBeUndefined();
      expect(
         container.querySelector('a[href="/settings/members"]')
      ).not.toBeNull();
   });
});
