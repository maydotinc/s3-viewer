import {
   afterAll,
   afterEach,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import useSessionStore from "./stores/sessionStore";
import { api, ApiError, setUnauthorizedHandler } from "./api";

vi.hoisted(() => {
   const memory = new Map<string, string>();
   vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
      removeItem: (key: string) => void memory.delete(key),
   });
});

vi.mock("@/lib/env", () => ({
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
