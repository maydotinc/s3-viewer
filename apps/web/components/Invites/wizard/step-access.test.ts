// @vitest-environment happy-dom
import { mountedRuntime, serverInfo } from "@/components/test-helpers";
import { Role, type ServerInfo } from "@s3-viewer/shared";
import { act, createElement, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { GrantRow } from "../bucket-grants";
import StepAccess from "./step-access";
import type { ServerBuckets } from "./useServerBuckets";
import type { ServerAccess } from "./wizard-state";

const h = vi.hoisted(() => ({
   expanded: new Map<string, boolean>(),
   onAccessChange: undefined as
      | ((
           serverId: string,
           fallback: ServerAccess,
           update: (current: ServerAccess) => ServerAccess
        ) => void)
      | undefined,
}));

vi.mock("./server-access-section", () => ({
   default: (props: {
      server: ServerInfo;
      expanded: boolean;
      onAccessChange: typeof h.onAccessChange;
   }) => {
      h.expanded.set(props.server.id, props.expanded);
      h.onAccessChange = props.onAccessChange;
      return null;
   },
}));

const servers = [
   serverInfo({ id: "one", name: "One" }),
   serverInfo({ id: "two", name: "Two" }),
];
const loaded = (serverId: string): ServerBuckets => ({
   serverId,
   buckets: [],
   isLoading: false,
   error: null,
   isFetching: false,
   refetch: () => {},
});
const row: GrantRow = { bucketName: "demo", role: Role.VIEWER, folders: null };

const Host = () => {
   const [access, setAccess] = useState<Record<string, ServerAccess>>({});
   return createElement(StepAccess, {
      servers,
      buckets: servers.map(({ id }) => loaded(id)),
      access,
      expanded: null,
      submitted: false,
      focusRequest: 0,
      onAccessChange: (serverId, fallback, update) =>
         setAccess((current) => ({
            ...current,
            [serverId]: update(current[serverId] ?? fallback),
         })),
      onExpand: () => {},
      onRemove: () => {},
   });
};

const view = mountedRuntime();

describe("the access accordion", () => {
   it("keeps the first server open after its first bucket is checked", async () => {
      await view.mount(createElement(Host));
      expect(h.expanded.get("one")).toBe(true);
      expect(h.expanded.get("two")).toBe(false);
      await act(async () =>
         h.onAccessChange!(
            "one",
            { role: Role.VIEWER, rows: [] },
            (current) => ({
               ...current,
               rows: [row],
            })
         )
      );
      expect(h.expanded.get("one")).toBe(true);
      expect(h.expanded.get("two")).toBe(false);
   });
});
