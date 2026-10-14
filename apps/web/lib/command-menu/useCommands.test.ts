// @vitest-environment happy-dom
import { mountRuntime } from "@/lib/test/runtime";
import { Provider, Role, type S3Bucket } from "@s3-viewer/types";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandItem } from "./types";

const h = vi.hoisted(() => ({
   serverRole: "VIEWER" as Role,
   canCreateBucket: undefined as boolean | undefined,
   buckets: [] as S3Bucket[],
   query: {} as Record<string, string | string[]>,
   openScoped: vi.fn(),
}));

vi.mock("next/router", () => ({
   useRouter: () => ({ query: h.query, push: vi.fn() }),
}));
const server = () => ({
   id: "server-1",
   name: "Primary",
   provider: Provider.S3,
   userRole: h.serverRole,
   canCreateBucket: h.canCreateBucket,
});
vi.mock("@/lib/hooks/queries/server/useCurrentServer", () => ({
   default: () => ({ currentServer: server(), isLoading: false }),
}));
vi.mock("@/lib/hooks/queries/server/useServers", () => ({
   default: () => ({
      servers: [server()],
      currentServer: server(),
      isLoading: false,
      hasNextPage: false,
      isFetching: false,
      fetchNextPage: vi.fn(),
      serverListError: null,
      isFetchNextPageError: false,
      refetch: vi.fn(),
   }),
}));
vi.mock("@/lib/hooks/queries/s3/useBuckets", () => ({
   default: (bucketName?: string) => ({
      buckets: h.buckets,
      currentBucket: h.buckets.find((bucket) => bucket.name === bucketName),
      isBucketsLoading: false,
   }),
}));
vi.mock("@/lib/hooks/useStorageCapabilities", () => ({
   useStorageCapabilities: () => ({
      upload: true,
      replace: true,
      rename: true,
      delete: true,
      deleteProtection: null,
      notice: null,
      pending: false,
   }),
}));
vi.mock("@/lib/hooks/useSwitchServer", () => ({
   useSwitchServer: () => vi.fn(),
}));
vi.mock("@/lib/contexts/modal-context", () => ({
   useModalActions: () => ({ openScoped: h.openScoped }),
}));
vi.mock("@/lib/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/shortcuts", () => ({
   useShortcutRegistry: () => ({ setHelpOpen: vi.fn() }),
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: (select: (state: { serverId: string }) => unknown) =>
      select({ serverId: "server-1" }),
}));
vi.mock("@s3-viewer/ui/components/sidebar", () => ({
   useSidebar: () => ({ toggleSidebar: vi.fn() }),
}));
vi.mock("@s3-viewer/ui/components/toast", () => ({ toast: {} }));

import { onListingChanged } from "@/lib/listing-events";
import useCommands from "./useCommands";

const GATED = [
   "action:create-bucket",
   "action:create-folder",
   "action:bulk-rename",
   "action:transfer-folder",
   "nav:invite",
   "nav:members",
   "action:rename-server",
   "action:update-credentials",
];

let commands!: CommandItem[];
const Probe = () => {
   commands = useCommands();
   return null;
};
let runtime: Awaited<ReturnType<typeof mountRuntime>> | undefined;
const mount = async () => {
   runtime = await mountRuntime(createElement(Probe));
   return commands;
};
const offered = async (): Promise<string[]> => {
   const ids = new Set((await mount()).map(({ id }) => id));
   return GATED.filter((id) => ids.has(id));
};

const bucket = (userRole: Role): S3Bucket => ({
   name: "site",
   creationDate: null,
   userRole,
   folders: null,
});

beforeEach(() => {
   h.query = { slug: ["site", "docs"] };
   h.canCreateBucket = undefined;
});

afterEach(async () => {
   await runtime?.unmount();
   runtime = undefined;
});

describe("commands follow the roles the API enforces", () => {
   it("gives a server viewer with an editor grant the folder actions only", async () => {
      h.serverRole = Role.VIEWER;
      h.buckets = [bucket(Role.EDITOR)];
      expect(await offered()).toEqual([
         "action:create-folder",
         "action:bulk-rename",
         "action:transfer-folder",
      ]);
   });

   it("gives a server admin who only views the bucket the server actions", async () => {
      h.serverRole = Role.ADMIN;
      h.buckets = [bucket(Role.VIEWER)];
      expect(await offered()).toEqual([
         "action:create-bucket",
         "action:transfer-folder",
         "nav:invite",
         "nav:members",
         "action:rename-server",
      ]);
   });

   it("gives the server owner everything, whatever role the bucket lists", async () => {
      h.serverRole = Role.OWNER;
      h.buckets = [bucket(Role.VIEWER)];
      expect(await offered()).toEqual(GATED);
   });

   it("offers no folder actions in a bucket the server does not list", async () => {
      h.serverRole = Role.OWNER;
      h.buckets = [];
      expect(await offered()).toEqual([
         "action:create-bucket",
         "nav:invite",
         "nav:members",
         "action:rename-server",
         "action:update-credentials",
      ]);
   });

   it("offers no folder actions outside a bucket", async () => {
      h.serverRole = Role.EDITOR;
      h.buckets = [bucket(Role.EDITOR)];
      h.query = {};
      expect(await offered()).toEqual(["action:create-bucket"]);
   });
});

describe("member commands", () => {
   it("open the invite wizard and the members page for the current server", async () => {
      h.serverRole = Role.OWNER;
      h.buckets = [];
      const all = await mount();
      const byId = (id: string) => all.find((command) => command.id === id);
      expect(byId("nav:invite")).toMatchObject({
         label: "Invite people",
         description: "Primary",
         href: "/settings/invites/new?server=server-1",
      });
      expect(byId("nav:members")).toMatchObject({
         label: "Manage members",
         description: "Primary",
         href: "/settings/members?server=server-1",
      });
   });
});

describe("bulk rename from the command menu", () => {
   it("reloads the open listing once objects were renamed", async () => {
      h.serverRole = Role.OWNER;
      h.buckets = [bucket(Role.OWNER)];
      const command = (await mount()).find(
         ({ id }) => id === "action:bulk-rename"
      );
      command?.run?.();
      const reload = vi.fn();
      const stopListening = onListingChanged(reload);
      h.openScoped.mock.lastCall?.[1].onRenamed();
      stopListening();
      h.openScoped.mock.lastCall?.[1].onRenamed();
      expect(reload).toHaveBeenCalledOnce();
   });
});

describe("creating a bucket on a server restricted to an allow-list", () => {
   it("is not offered when the API says this member can't", async () => {
      h.serverRole = Role.ADMIN;
      h.buckets = [bucket(Role.VIEWER)];
      h.canCreateBucket = false;
      expect(await offered()).not.toContain("action:create-bucket");
   });

   it("is offered when the API allows it", async () => {
      h.serverRole = Role.EDITOR;
      h.buckets = [bucket(Role.VIEWER)];
      h.canCreateBucket = true;
      expect(await offered()).toContain("action:create-bucket");
   });
});
