import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "./query-keys";
import { refreshAccess } from "./query-client";
import { deferred } from "./test/runtime";

const watch = (client: QueryClient, queryKey: readonly unknown[]) => {
   const queryFn = vi.fn(async () => []);
   const observer = new QueryObserver(client, {
      queryKey,
      queryFn,
      staleTime: Infinity,
   });
   const stop = observer.subscribe(() => undefined);
   return { queryFn, stop };
};

describe("an access refusal", () => {
   it("reloads the bucket lists and server info once for a burst of refusals", async () => {
      const client = new QueryClient();
      const buckets = watch(client, queryKeys.buckets("user", "server"));
      const server = watch(client, queryKeys.serverInfo("user", "server"));
      const members = watch(client, queryKeys.members("user", "server"));
      await vi.waitFor(() => expect(buckets.queryFn).toHaveBeenCalledOnce());
      const gate = deferred<void>();
      buckets.queryFn.mockImplementation(async () => {
         await gate.promise;
         return [];
      });
      const refresh = refreshAccess(client);
      refresh();
      refresh();
      refresh();
      await vi.waitFor(() => expect(buckets.queryFn).toHaveBeenCalledTimes(2));
      gate.resolve();
      await vi.waitFor(() =>
         expect(
            client.getQueryState(queryKeys.buckets("user", "server"))
               ?.fetchStatus
         ).toBe("idle")
      );
      expect(buckets.queryFn).toHaveBeenCalledTimes(2);
      expect(server.queryFn).toHaveBeenCalledTimes(2);
      expect(members.queryFn).toHaveBeenCalledOnce();
      await new Promise((resolve) => setTimeout(resolve, 0));
      refresh();
      await vi.waitFor(() => expect(buckets.queryFn).toHaveBeenCalledTimes(3));
      buckets.stop();
      server.stop();
      members.stop();
   });
});
