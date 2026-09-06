import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/queryKeys";

const h = vi.hoisted(() => ({
   get: vi.fn(),
   options: null as {
      queryKey: readonly unknown[];
      queryFn: () => Promise<string[]>;
   } | null,
}));
vi.mock("@/lib/stores/sessionStore", () => ({
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

beforeEach(() => {
   h.options = null;
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
         queryKeys.objects(
            "original-user",
            "original-server",
            "backups",
            "folder/"
         )
      );
      expect(await h.options?.queryFn()).toEqual(["folder/next.txt"]);
      expect(h.get).toHaveBeenCalledWith(
         "/servers/original-server/buckets/backups/objects"
      );
   });

   it("continues to use the current selection for the grid's prefix search", async () => {
      useObjectKeys("backups", "folder/", true);
      expect(h.options?.queryKey).toEqual(
         queryKeys.objects(
            "signed-in-user",
            "selected-server",
            "backups",
            "folder/"
         )
      );
      await h.options?.queryFn();
      expect(h.get).toHaveBeenCalledWith(
         "/servers/selected-server/buckets/backups/objects"
      );
   });
});
