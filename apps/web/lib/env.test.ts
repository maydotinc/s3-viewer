import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SERVER = {
   NEXT_PUBLIC_SITE_URL: "https://server.example.com",
   NEXT_PUBLIC_API_URL: "https://api.server.example.com",
};

const CLIENT = {
   siteUrl: "https://client.example.com",
   apiUrl: "https://api.client.example.com",
};

const asBrowser = (nextData: unknown) => {
   vi.stubGlobal("window", {});
   vi.stubGlobal("document", {
      getElementById: (id: string) =>
         id === "__NEXT_DATA__" && nextData !== undefined
            ? { textContent: JSON.stringify(nextData) }
            : null,
   });
};

const load = () => import("./env");

beforeEach(() => {
   vi.resetModules();
   for (const [key, value] of Object.entries(SERVER)) vi.stubEnv(key, value);
   vi.stubEnv("LANDING_ORIGIN", "http://landing.localhost:3001");
});

afterEach(() => {
   vi.unstubAllGlobals();
   vi.unstubAllEnvs();
});

describe("publicEnv on the server", () => {
   it("reads the origins from the running process", async () => {
      const { publicEnv } = await load();
      expect(publicEnv.siteOrigin).toBe(SERVER.NEXT_PUBLIC_SITE_URL);
      expect(publicEnv.apiOrigin).toBe(SERVER.NEXT_PUBLIC_API_URL);
   });

   it("is empty when the process has no origins, and never throws", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
      vi.stubEnv("NEXT_PUBLIC_API_URL", "");
      const { publicEnv } = await load();
      expect(publicEnv.siteOrigin).toBe("");
      expect(publicEnv.apiOrigin).toBe("");
   });

   it("exposes the landing origin", async () => {
      const { landingOrigin } = await load();
      expect(landingOrigin).toBe("http://landing.localhost:3001");
   });
});

describe("publicEnv in the browser", () => {
   it("reads the origins the server put in __NEXT_DATA__", async () => {
      asBrowser({ props: { runtimeEnv: CLIENT } });
      const { publicEnv } = await load();
      expect(publicEnv.siteOrigin).toBe(CLIENT.siteUrl);
      expect(publicEnv.apiOrigin).toBe(CLIENT.apiUrl);
   });

   it("prefers __NEXT_DATA__ over anything baked into the bundle", async () => {
      asBrowser({ props: { runtimeEnv: CLIENT } });
      const { publicEnv } = await load();
      expect(publicEnv.apiOrigin).not.toBe(SERVER.NEXT_PUBLIC_API_URL);
   });

   it("falls back to empty origins when the page carries none", async () => {
      asBrowser({ props: {} });
      const { publicEnv } = await load();
      expect(publicEnv.siteOrigin).toBe("");
      expect(publicEnv.apiOrigin).toBe("");
   });

   it("survives an unparseable __NEXT_DATA__", async () => {
      vi.stubGlobal("window", {});
      vi.stubGlobal("document", {
         getElementById: () => ({ textContent: "{" }),
      });
      const { publicEnv } = await load();
      expect(publicEnv.apiOrigin).toBe("");
   });
});

describe("setRuntimeEnv", () => {
   it("normalises what _app hands it", async () => {
      const { publicEnv, setRuntimeEnv } = await load();
      setRuntimeEnv({
         siteUrl: "app.example.com",
         apiUrl: "http://api.example.com/base/",
      });
      expect(publicEnv.siteOrigin).toBe("https://app.example.com");
      expect(publicEnv.apiOrigin).toBe("http://api.example.com");
   });

   it("leaves the resolved values alone when given nothing", async () => {
      const { publicEnv, setRuntimeEnv } = await load();
      setRuntimeEnv(undefined);
      expect(publicEnv.apiOrigin).toBe(SERVER.NEXT_PUBLIC_API_URL);
   });
});

describe("serverRuntimeEnv", () => {
   it("returns the raw pair _app serialises into the page", async () => {
      const { serverRuntimeEnv } = await load();
      expect(serverRuntimeEnv()).toEqual({
         siteUrl: SERVER.NEXT_PUBLIC_SITE_URL,
         apiUrl: SERVER.NEXT_PUBLIC_API_URL,
      });
   });
});
