import { beforeEach, expect, it, vi } from "vitest";
import * as React from "react";
import type { TransferSummary } from "@/lib/hooks/mutations/object/useTransferObjects";

const h = vi.hoisted(() => ({
   slots: [] as unknown[],
   cursor: 0,
   mutate: vi.fn(),
   buckets: [{ name: "bucket", userRole: "EDITOR" }] as unknown[],
   servers: [] as unknown[],
   loading: false,
   effects: false,
   preflight: vi.fn(),
}));
vi.mock("react", async (original) => ({
   ...(await original<typeof React>()),
   useState: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = initial;
      return [
         h.slots[index],
         (value: unknown) => {
            h.slots[index] =
               typeof value === "function" ? value(h.slots[index]) : value;
         },
      ];
   },
   useRef: (current: unknown) => {
      const index = h.cursor++;
      return (h.slots[index] ??= { current });
   },
   useId: () => String(h.cursor++),
   useEffect: (run: () => void) => {
      if (h.effects) run();
   },
}));
vi.mock(
   "@/lib/hooks/mutations/object/useTransferObjects",
   async (original) => ({
      ...(await original<
         typeof import("@/lib/hooks/mutations/object/useTransferObjects")
      >()),
      default: () => ({ isPending: false, mutate: h.mutate }),
   })
);
vi.mock("@/lib/hooks/queries/server/useServers", () => ({
   default: () => ({ servers: h.servers }),
}));
vi.mock("@/lib/stores/session-store", () => ({
   useUserId: () => "user",
}));
vi.mock("@/lib/hooks/queries/s3/useBucketsForServer", () => ({
   default: () => ({ buckets: h.buckets, isLoading: h.loading }),
}));
vi.mock("@/lib/hooks/queries/s3/useBuckets", () => ({ default: vi.fn() }));
vi.mock("@/lib/hooks/queries/server/useCurrentServer", () => ({
   default: vi.fn(),
}));
vi.mock("./useTransferPreflight", () => ({
   default: h.preflight,
}));
vi.mock("@/lib/hooks/usePathSuggestion", () => ({
   usePathSuggestion: () => "",
}));
vi.mock("@/lib/hooks/useAbortableTask", () => ({
   useAbortableTask: () => ({
      start: () => new AbortController().signal,
      ifMounted: (fn: () => void) => fn(),
      cancel: vi.fn(),
   }),
}));
vi.mock("@/lib/hooks/useBeforeUnload", () => ({ useBeforeUnload: vi.fn() }));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock()
);

import Modal from "./index";
import { SelectItem } from "@s3-viewer/ui/components/select";

type Element = React.ReactElement<Record<string, unknown>>;
const nodes = (value: unknown): Element[] => {
   if (Array.isArray(value)) return value.flatMap(nodes);
   if (!React.isValidElement(value)) return [];
   const element = value as Element;
   return [element, ...nodes(element.props.children)];
};
const defaults = {
   onClose: vi.fn(),
   userId: "user",
   serverId: "server",
   bucketName: "bucket",
   source: {
      prefix: "raw/",
      objects: [
         { key: "raw/a", expectedETag: '"a"' },
         { key: "raw/b", expectedETag: '"b"' },
      ],
   },
};
const render = (props = defaults) => {
   h.cursor = 0;
   return Modal(props) as Element;
};
const offered = (tree: Element) =>
   nodes(tree)
      .filter(({ type }) => type === SelectItem)
      .map(({ props }) => props.value);
const submit = (tree: Element) =>
   (tree.props.onSubmit as (event: unknown) => void)({
      preventDefault: vi.fn(),
   });
const server = (overrides: Record<string, unknown> = {}) => ({
   id: "server",
   name: "Server",
   userRole: "EDITOR",
   capabilities: { writable: true },
   ...overrides,
});
beforeEach(() => {
   h.buckets = [{ name: "bucket", userRole: "EDITOR" }];
   h.servers = [server()];
   h.loading = false;
   h.effects = false;
   h.slots = [];
   h.cursor = 0;
   vi.clearAllMocks();
   h.preflight.mockReturnValue({ isChecking: false, isReady: false });
});

it("freezes every destination control after starting and carries the same operation through continuation", () => {
   const initial = render();
   const path = nodes(initial).find(
      ({ props }) => props.placeholder === "reports/"
   )!;
   (path.props.onChange as (event: unknown) => void)({
      target: { value: "archive/" },
   });
   submit(render());
   const [input, callbacks] = h.mutate.mock.calls[0]!;
   const started = render();
   const controls = nodes(started).filter(
      ({ props }) =>
         "onValueChange" in props ||
         "onCheckedChange" in props ||
         props.placeholder === "reports/"
   );
   expect(new Set(controls.map(({ props }) => props.disabled))).toEqual(
      new Set([true])
   );
   callbacks.onSuccess({
      transferred: 1,
      skipped: 0,
      bytes: 1,
      failed: [{ key: "raw/b", message: "Busy", retryable: true }],
      listingError: null,
      remaining: true,
   } satisfies TransferSummary);
   const continued = render();
   expect(continued.props.submitLabel).toBe("Continue copying");
   submit(continued);
   expect(h.mutate.mock.calls[1]?.[0].operation).toBe(input.operation);
   expect(h.mutate.mock.calls[1]?.[0].destination).toEqual(input.destination);
});

it("blocks an overlapping folder destination in the dialog", () => {
   const props = { ...defaults, source: { folderKey: "raw/deep/" } };
   h.cursor = 0;
   const initial = Modal(props) as Element;
   const path = nodes(initial).find(
      ({ props }) => props.placeholder === "reports/"
   )!;
   (path.props.onChange as (event: unknown) => void)({
      target: { value: "raw/" },
   });
   h.cursor = 0;
   const changed = Modal(props) as Element;
   expect(changed.props.submitDisabled).toBe(true);
   submit(changed);
   expect(h.mutate).not.toHaveBeenCalled();
});

const typeDestination = (props: typeof defaults, destination: string) => {
   const path = nodes(render(props)).find(
      ({ props: inputProps }) => inputProps.placeholder === "reports/"
   )!;
   (path.props.onChange as (event: unknown) => void)({
      target: { value: destination },
   });
   return render(props);
};
const shown = (tree: Element) =>
   nodes(tree)
      .flatMap(({ props }) =>
         typeof props.children === "string" ? [props.children] : []
      )
      .join(" ");

it("keeps a copy inside the destination folders someone was given", () => {
   h.buckets = [
      {
         name: "bucket",
         userRole: "EDITOR",
         creationDate: null,
         folders: ["landing/"],
      },
   ];
   const outside = typeDestination(defaults, "archive/");
   expect(outside.props.submitDisabled).toBe(true);
   expect(shown(outside)).toContain(
      "You can only write inside landing/ in this bucket."
   );
   submit(outside);
   expect(h.mutate).not.toHaveBeenCalled();
   h.slots = [];
   expect(
      typeDestination(defaults, "landing/copies/").props.submitDisabled
   ).toBe(false);
});

it.each([
   ["a viewer of the destination", [server()], "VIEWER"],
   [
      "a server that can't take uploads",
      [server({ capabilities: { writable: false } })],
      "EDITOR",
   ],
])(
   "offers no destination and sends nothing for %s",
   (_name, servers, userRole) => {
      h.servers = servers;
      h.buckets = [{ name: "bucket", userRole }];
      const tree = typeDestination(defaults, "archive/");
      expect(tree.props.submitDisabled).toBe(true);
      expect(shown(tree)).toContain(
         "You can't add files to any bucket on this server."
      );
      expect(h.preflight.mock.lastCall?.[3]).toBe(false);
      expect(offered(tree)).toEqual(["server"]);
      submit(tree);
      expect(h.mutate).not.toHaveBeenCalled();
   }
);

it("lets a server owner copy into a bucket whatever its own role says", () => {
   h.servers = [server({ userRole: "OWNER" })];
   h.buckets = [{ name: "bucket", userRole: "VIEWER" }];
   const tree = typeDestination(defaults, "archive/");
   expect(tree.props.submitDisabled).toBe(false);
   expect(h.preflight.mock.lastCall?.[3]).toBe(true);
});

it("lists only buckets that accept uploads and moves the choice onto one", () => {
   h.effects = true;
   h.buckets = [
      { name: "bucket", userRole: "VIEWER" },
      { name: "drafts", userRole: "EDITOR" },
      { name: "public", userRole: "VIEWER" },
   ];
   render();
   const tree = typeDestination(defaults, "archive/");
   expect(offered(tree)).toEqual(["server", "drafts"]);
   expect(tree.props.submitDisabled).toBe(false);
   submit(tree);
   expect(h.mutate.mock.calls[0]?.[0].destination).toEqual({
      serverId: "server",
      bucketName: "drafts",
      prefix: "archive/",
   });
});

it("never copies into a read-only bucket while the choice is still moving off it", () => {
   h.buckets = [
      { name: "bucket", userRole: "VIEWER" },
      { name: "drafts", userRole: "EDITOR" },
   ];
   const tree = typeDestination(defaults, "archive/");
   expect(tree.props.submitDisabled).toBe(true);
   expect(h.preflight.mock.lastCall?.[3]).toBe(false);
   submit(tree);
   expect(h.mutate).not.toHaveBeenCalled();
});

it("clears a carried-over bucket name when the chosen server has nothing writable", () => {
   h.effects = true;
   h.buckets = [];
   render();
   const tree = typeDestination(defaults, "archive/");
   expect(tree.props.submitDisabled).toBe(true);
   expect(h.preflight.mock.lastCall?.[1]).toBe("");
   submit(tree);
   expect(h.mutate).not.toHaveBeenCalled();
});

it("holds the copy and the destination check while buckets load, without an error", () => {
   h.loading = true;
   h.buckets = [];
   const tree = typeDestination(defaults, "archive/");
   expect(tree.props.submitDisabled).toBe(true);
   expect(shown(tree)).not.toContain("bucket on this server");
   expect(shown(tree)).not.toContain("Pick a destination bucket.");
   expect(h.preflight.mock.lastCall?.[3]).toBe(false);
   submit(tree);
   expect(h.mutate).not.toHaveBeenCalled();
});
