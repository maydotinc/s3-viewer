import {
   afterAll,
   afterEach,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import {
   ErrorCode,
   EXPECTED_USER_ID_HEADER,
   GENERIC_ERROR_MESSAGE,
} from "@s3-viewer/shared";
import useSessionStore from "@/lib/stores/session-store";
import {
   api,
   ApiError,
   ClientErrorCode,
   responseError,
   setAccessRefusalHandler,
   setUnauthorizedHandler,
} from "./api";

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

   it("binds a write to the actor captured before fetch begins", async () => {
      const fetch = vi.fn(async () => {
         useSessionStore.getState().setUserId("account-b");
         return new Response(null, { status: 204 });
      });
      vi.stubGlobal("fetch", fetch);
      await api.post("/servers/server-a", { name: "updated" });
      expect(fetch).toHaveBeenCalledWith(
         expect.any(String),
         expect.objectContaining({
            headers: {
               "Content-Type": "application/json",
               [EXPECTED_USER_ID_HEADER]: "account-a",
            },
         })
      );
   });

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

   it("reports a cancelled request as cancelled, not as a network failure", async () => {
      vi.stubGlobal(
         "fetch",
         vi.fn(async () => {
            throw new DOMException("Aborted", "AbortError");
         })
      );
      await expect(api.get("/servers")).rejects.toMatchObject({
         code: ClientErrorCode.ABORTED,
      });
   });

   it("gives up on a read that never answers but still honours the caller's cancel", async () => {
      const timeouts: AbortController[] = [];
      vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
         const controller = new AbortController();
         timeouts.push(controller);
         return controller.signal;
      });
      vi.stubGlobal(
         "fetch",
         vi.fn(
            (_url: string, init: RequestInit) =>
               new Promise((_resolve, reject) =>
                  init.signal!.addEventListener("abort", () =>
                     reject(init.signal!.reason)
                  )
               )
         )
      );
      const stuck = api.get("/servers");
      timeouts[0]!.abort(new DOMException("timed out", "TimeoutError"));
      await expect(stuck).rejects.toMatchObject({
         status: 0,
         code: ClientErrorCode.NETWORK,
         message: expect.stringContaining("too long"),
      });
      const caller = new AbortController();
      const cancelled = api.get("/servers", caller.signal);
      caller.abort();
      await expect(cancelled).rejects.toMatchObject({
         code: ClientErrorCode.ABORTED,
      });
      vi.stubGlobal(
         "fetch",
         vi.fn(async () => new Response(null, { status: 204 }))
      );
      await api.post("/servers", {});
      expect(timeouts).toHaveLength(2);
      vi.restoreAllMocks();
   });

   it("keeps the API's code and falls back to a generic message", async () => {
      vi.stubGlobal(
         "fetch",
         vi.fn(
            async () =>
               new Response(
                  JSON.stringify({ message: "Changed", code: "STALE" }),
                  { status: 412 }
               )
         )
      );
      await expect(api.get("/servers")).rejects.toMatchObject({
         status: 412,
         message: "Changed",
         code: "STALE",
      });
      vi.stubGlobal(
         "fetch",
         vi.fn(
            async () =>
               new Response("<html>Bad gateway</html>", { status: 502 })
         )
      );
      await expect(api.get("/servers")).rejects.toMatchObject({
         status: 502,
         message: GENERIC_ERROR_MESSAGE,
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

describe("an access refusal", () => {
   afterEach(() => setAccessRefusalHandler(() => undefined));

   it("reaches the handler for a folder refusal or a bare 403, and nothing else", () => {
      const handler = vi.fn();
      setAccessRefusalHandler(handler);
      responseError(403, { message: "Nope", code: ErrorCode.VALIDATION });
      responseError(404, { message: "Not found" });
      expect(handler).not.toHaveBeenCalled();
      responseError(403, {
         message: "Your access to this bucket is limited to landing/",
         code: ErrorCode.FOLDER_ACCESS,
      });
      responseError(403, { message: "Forbidden" });
      expect(handler).toHaveBeenCalledTimes(2);
   });
});
