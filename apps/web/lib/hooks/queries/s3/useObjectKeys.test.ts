import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query-keys";
import type { KnownReach } from "@/lib/utils/folder-access";

const h = vi.hoisted(() => ({
   get: vi.fn(),
   options: null as {
      queryKey: readonly unknown[];
      queryFn: (context: { signal: AbortSignal }) => Promise<string[]>;
      enabled: boolean;
   } | null,
   reach: { folders: null, owner: false } as KnownReach,
   reachArgs: [] as unknown[],
}));
vi.mock("./useBucketScope", () => ({
   default: (...args: unknown[]) => {
      h.reachArgs = args;
      return h.reach;
   },
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: (select: (state: { serverId: string }) => unknown) =>
      select({ serverId: "selected-server" }),
   useUserId: () => "signed-in-user",
}));
vi.mock("@tanstack/react-query", () => ({
   useQuery: (options: typeof h.options) => {
      h.options = options;
      return { data: [] };
   },
}));
vi.mock("@/lib/api", () => ({
   api: { get: h.get },
   objectsPath: (serverId: string, bucket: string) =>
      `/servers/${serverId}/buckets/${bucket}/objects`,
   qs: () => "",
}));
import useObjectKeys from "./useObjectKeys";

const signal = new AbortController().signal;

beforeEach(() => {
   h.options = null;
   h.reach = { folders: null, owner: false };
   h.get.mockReset();
   h.get.mockResolvedValue({ objects: [{ key: "folder/next.txt" }] });
});

describe("path suggestion scope", () => {
   it("queries and caches rename suggestions under the modal's captured target", async () => {
      useObjectKeys("backups", "folder/", true, {
         userId: "original-user",
         serverId: "original-server",
      });
      expect(h.options?.queryKey).toEqual(
         queryKeys.objectKeySuggestions(
            "original-user",
            "original-server",
            "backups",
            "folder/"
         )
      );
      expect(await h.options?.queryFn({ signal })).toEqual(["folder/next.txt"]);
      expect(h.get).toHaveBeenCalledWith(
         "/servers/original-server/buckets/backups/objects",
         signal
      );
   });

   it("continues to use the current selection for the grid's prefix search", async () => {
      useObjectKeys("backups", "folder/", true);
      expect(h.options?.queryKey).toEqual(
         queryKeys.objectKeySuggestions(
            "signed-in-user",
            "selected-server",
            "backups",
            "folder/"
         )
      );
      await h.options?.queryFn({ signal });
      expect(h.get).toHaveBeenCalledWith(
         "/servers/selected-server/buckets/backups/objects",
         signal
      );
   });
});

describe("prefixes only the owner may list", () => {
   it("checks the bucket of the captured target", () => {
      useObjectKeys("backups", "folder/", true, {
         userId: "original-user",
         serverId: "original-server",
      });
      expect(h.reachArgs).toEqual([
         "original-user",
         "original-server",
         "backups",
      ]);
      expect(h.options?.enabled).toBe(true);
   });

   it.each(["a/..", "a/../", "./", "a\\..\\b"])(
      "has no suggestions for %j instead of a refused listing",
      (prefix) => {
         useObjectKeys("backups", prefix, true);
         expect(h.options?.enabled).toBe(false);
      }
   );

   it("still suggests while a name is being typed", () => {
      useObjectKeys("backups", "a/.e", true);
      expect(h.options?.enabled).toBe(true);
   });

   it("waits to know who is asking before listing a dotted prefix", () => {
      h.reach = undefined;
      useObjectKeys("backups", "a/..", true);
      expect(h.options?.enabled).toBe(false);
   });

   it("lists anything for the server owner", () => {
      h.reach = { folders: null, owner: true };
      useObjectKeys("backups", "a/..", true);
      expect(h.options?.enabled).toBe(true);
   });
});

describe("suggestions fed by the grid's listing", () => {
   it("never lists the prefix itself when asked to read the cache only", () => {
      h.reach = { folders: null, owner: true };
      useObjectKeys("backups", "folder/re", true, undefined, true);
      expect(h.options?.enabled).toBe(false);
      expect(h.options?.queryKey).toEqual(
         queryKeys.objectKeySuggestions(
            "signed-in-user",
            "selected-server",
            "backups",
            "folder/re"
         )
      );
   });
});
