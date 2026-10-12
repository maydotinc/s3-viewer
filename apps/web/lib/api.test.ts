import {
   afterAll,
   afterEach,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { EXPECTED_USER_ID_HEADER } from "@s3-viewer/types";
import useSessionStore from "@/lib/stores/session-store";
import { api, ApiError, setUnauthorizedHandler } from "./api";

await vi.hoisted(async () => {
   const { createMemoryStorage } = await import("@/lib/test/storage");
   vi.stubGlobal("localStorage", createMemoryStorage());
});

vi.mock("./env", () => ({
   publicEnv: { apiOrigin: "https://api.example.test" },
}));

describe("API session response ordering", () => {
   const unauthorized = vi.fn();

   beforeEach(() => {
      unauthorized.mockClear();
      setUnauthorizedHandler(unauthorized);
      useSessionStore.getState().setUserId("account-a");
   });

   afterEach(() => {
      setUnauthorizedHandler(() => undefined);
      useSessionStore.getState().clearSession();
   });

   afterAll(() => vi.unstubAllGlobals());

   it.each(["post", "patch", "delete"] as const)(
      "binds %s to the actor captured before fetch begins",
      async (method) => {
         const fetch = vi.fn(async () => {
            useSessionStore.getState().setUserId("account-b");
            return new Response(null, { status: 204 });
         });
         vi.stubGlobal("fetch", fetch);
         await api[method]("/servers/server-a", { name: "updated" });
         expect(fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
               headers: {
                  "Content-Type": "application/json",
                  [EXPECTED_USER_ID_HEADER]: "account-a",
               },
            })
         );
      }
   );

   it("binds bodyless writes and leaves reads unbound", async () => {
      const fetch = vi.fn(async () => new Response(null, { status: 204 }));
      vi.stubGlobal("fetch", fetch);
      await api.delete("/servers/server-a");
      expect(fetch).toHaveBeenLastCalledWith(
         expect.any(String),
         expect.objectContaining({
            headers: { [EXPECTED_USER_ID_HEADER]: "account-a" },
         })
      );
      await api.get("/servers");
      expect(fetch).toHaveBeenLastCalledWith(
         expect.any(String),
         expect.objectContaining({ headers: {} })
      );
   });

   it("reports a non-JSON success body as a bad response, not a dead connection", async () => {
      vi.stubGlobal(
         "fetch",
         vi.fn(
            async () =>
               new Response("<html>maintenance</html>", {
                  status: 200,
                  headers: { "content-type": "text/html" },
               })
         )
      );
      await expect(api.get("/servers")).rejects.toMatchObject({
         status: 200,
         code: "BAD_RESPONSE",
      });
   });

   it("does not expire account B when account A's request returns a delayed 401", async () => {
      let respond!: (response: Response) => void;
      vi.stubGlobal(
         "fetch",
         vi.fn(() => new Promise<Response>((resolve) => (respond = resolve)))
      );
      const pending = api.get("/servers");
      useSessionStore.getState().setUserId("account-b");
      respond(Response.json({ message: "Session expired" }, { status: 401 }));

      await expect(pending).rejects.toBeInstanceOf(ApiError);
      expect(unauthorized).not.toHaveBeenCalled();
      expect(useSessionStore.getState().userId).toBe("account-b");
   });

   it("expires the current account when its request is unauthorized", async () => {
      vi.stubGlobal(
         "fetch",
         vi.fn(async () =>
            Response.json({ message: "Session expired" }, { status: 401 })
         )
      );

      await expect(api.get("/servers")).rejects.toMatchObject({ status: 401 });
      expect(unauthorized).toHaveBeenCalledOnce();
   });
});
