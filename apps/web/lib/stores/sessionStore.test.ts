import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
   getItem: (key: string) => memory.get(key) ?? null,
   setItem: (key: string, value: string) => void memory.set(key, value),
   removeItem: (key: string) => void memory.delete(key),
});

let useSessionStore: typeof import("./sessionStore").default;
let resolveServerId: typeof import("./sessionStore").resolveServerId;

beforeAll(async () => {
   ({ default: useSessionStore, resolveServerId } = await import(
      "./sessionStore"
   ));
});

beforeEach(() => {
   useSessionStore.setState({ serverId: "", userId: null });
});

const countEmits = (run: () => void): number => {
   let emits = 0;
   const unsubscribe = useSessionStore.subscribe(() => emits++);
   run();
   unsubscribe();
   return emits;
};

describe("resolveServerId", () => {
   const servers = [{ id: "a" }, { id: "b" }];

   it("keeps the current server while it exists", () => {
      expect(resolveServerId(servers, "b")).toBe("b");
   });

   it("falls back to the first server, or none", () => {
      expect(resolveServerId(servers, "gone")).toBe("a");
      expect(resolveServerId([], "gone")).toBe("");
      expect(resolveServerId([], "")).toBe("");
   });
});

describe("useSessionStore", () => {
   it("does not emit when a setter receives the current value", () => {
      const { setServerId, setUserId, clearSession } =
         useSessionStore.getState();
      expect(countEmits(() => setServerId(""))).toBe(0);
      expect(countEmits(() => setUserId(null))).toBe(0);
      expect(countEmits(() => clearSession())).toBe(0);

      setUserId("u1");
      setServerId("s1");
      expect(countEmits(() => setUserId("u1"))).toBe(0);
      expect(countEmits(() => setServerId("s1"))).toBe(0);
   });

   it("emits once per real change", () => {
      const { setServerId, setUserId, clearSession } =
         useSessionStore.getState();
      expect(countEmits(() => setUserId("u1"))).toBe(1);
      expect(countEmits(() => setServerId("s1"))).toBe(1);
      expect(countEmits(() => clearSession())).toBe(1);
      expect(useSessionStore.getState()).toMatchObject({
         userId: null,
         serverId: "",
      });
   });

   it("forgets the selected server when a different user signs in", () => {
      const { setServerId, setUserId } = useSessionStore.getState();
      setUserId("u1");
      setServerId("s1");
      setUserId("u2");
      expect(useSessionStore.getState()).toMatchObject({
         userId: "u2",
         serverId: "",
      });
   });

   it("keeps the selected server when the same user signs back in", () => {
      const { setServerId, setUserId } = useSessionStore.getState();
      setServerId("s1");
      setUserId("u1");
      expect(useSessionStore.getState().serverId).toBe("s1");
   });
});
