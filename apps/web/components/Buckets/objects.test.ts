import * as React from "react";
import { all } from "@/lib/test/elements";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Objects from "./objects";

const h = vi.hoisted(() => ({
   bucketsError: null as Error | null,
   filter: "",
}));

vi.mock("react", async (original) => ({
   ...(await original<typeof React>()),
   useState: () => [null, vi.fn()],
   useRef: () => ({ current: null }),
   useMemo: (create: () => unknown) => create(),
   useCallback: (callback: unknown) => callback,
   useEffect: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/lib/stores/session-scope", () => ({ useServerId: () => "server" }));
vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "user" }));
vi.mock("@/lib/stores/preferences-store", () => ({
   default: (select: (state: { foldersFirst: boolean }) => unknown) =>
      select({ foldersFirst: true }),
}));
vi.mock("./Context", () => ({
   useBucketContext: () => ({
      bucketName: "bucket",
      prefix: "",
      reach: { folders: ["team/"], owner: false },
      awaitingReach: false,
      notFound: false,
      bucketsError: h.bucketsError,
      isRefreshing: false,
   }),
   useBucketFilter: () => ({ filter: h.filter }),
}));
vi.mock("./useObjectCommands", () => ({
   ObjectCommandsProvider: "commands",
   useCreateObjectCommands: () => ({}),
}));
vi.mock("@/components/Buckets/Grid/object-source", () => ({
   createObjectDatasource: vi.fn(),
   prefetchFirstBlock: () => ({}),
}));
vi.mock("@/components/Buckets/Grid/columns", () => ({
   objectColumns: [],
   objectRowId: vi.fn(),
}));
vi.mock("@/components/Buckets/Grid/grid-state", () => ({
   ObjectGridStateProvider: "grid-state",
}));
vi.mock("@/components/Buckets/Grid/selection", () => ({
   objectRowSelection: {},
}));
vi.mock("@/components/DataGrid/lazy-grid", () => ({ LazyGrid: "grid" }));
vi.mock("@/components/DataGrid/overlays", () => ({ EmptyState: "empty" }));
vi.mock("@/components/DataGrid/page-controls", () => ({
   default: "pagination",
}));
vi.mock("@/components/DataGrid/skeleton", () => ({
   FittedGridSkeleton: "skeleton",
}));
vi.mock("@/components/Layout/page", () => ({
   Page: "main",
   PageHeader: "header",
}));
vi.mock("./header", () => ({ default: "bucket-header" }));
vi.mock("./toolbar", () => ({ default: "toolbar" }));
vi.mock("@/components/Buckets/Upload/drop-zone", () => ({
   default: "drop-zone",
}));
vi.mock("@/components/Buckets/Upload/provider", () => ({
   UploadProvider: "uploads",
}));
vi.mock("./unavailable", () => ({ default: "unavailable" }));
vi.mock("./folder-access", () => ({
   DottedPath: "dotted",
   FolderAccessNotice: "folder-notice",
   NoFolderAccess: "no-access",
}));

const rendered = (type: string) =>
   all(Objects(), (element) => element.type === type).length > 0;

describe("Objects", () => {
   beforeEach(() => {
      h.bucketsError = null;
      h.filter = "";
   });

   it("keeps the folder notice under a listing error", () => {
      h.bucketsError = new Error("down");
      expect(rendered("unavailable")).toBe(true);
      expect(rendered("folder-notice")).toBe(true);
   });

   it("keeps the folder notice when the filter has a dot segment", () => {
      h.filter = "../";
      expect(rendered("empty")).toBe(true);
      expect(rendered("folder-notice")).toBe(true);
   });
});
