import { queryKeys } from "@/lib/query-keys";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { forgetKeys } from "./invalidate";

it("refetches an observed object query and drops unobserved ones", async () => {
   const client = new QueryClient();
   const settingsKey = queryKeys.objectSettings("u", "s", "b", "a.txt");
   const previewKey = queryKeys.objectPreview("u", "s", "b", "a.txt");
   let eTag = '"old"';
   const queryFn = vi.fn(async () => ({ eTag }));
   const observer = new QueryObserver(client, {
      queryKey: settingsKey,
      queryFn,
      staleTime: Infinity,
   });
   const unsubscribe = observer.subscribe(() => undefined);
   await vi.waitFor(() =>
      expect(observer.getCurrentResult().isSuccess).toBe(true)
   );
   client.setQueryData(previewKey, { eTag });

   eTag = '"new"';
   forgetKeys(client, "u", "s", "b", ["a.txt"]);

   expect(
      client.getQueryCache().find({ queryKey: previewKey })
   ).toBeUndefined();
   await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toEqual({ eTag: '"new"' })
   );
   expect(queryFn).toHaveBeenCalledTimes(2);
   unsubscribe();
});

it("drops an observed query for a removed key instead of refetching it", async () => {
   const client = new QueryClient();
   const settingsKey = queryKeys.objectSettings("u", "s", "b", "a.txt");
   const queryFn = vi.fn(async () => ({ eTag: '"old"' }));
   const observer = new QueryObserver(client, {
      queryKey: settingsKey,
      queryFn,
      staleTime: Infinity,
   });
   const unsubscribe = observer.subscribe(() => undefined);
   await vi.waitFor(() =>
      expect(observer.getCurrentResult().isSuccess).toBe(true)
   );

   forgetKeys(client, "u", "s", "b", ["b.txt"], ["a.txt"]);

   expect(
      client.getQueryCache().find({ queryKey: settingsKey })
   ).toBeUndefined();
   await new Promise((resolve) => setTimeout(resolve, 0));
   expect(queryFn).toHaveBeenCalledTimes(1);
   unsubscribe();
});
