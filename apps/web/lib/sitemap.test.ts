import { LANDING_ROUTES } from "@/lib/site-config";
import { SITE_PATHS } from "@s3-viewer/types";
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   siteOrigin: "https://app.example.com",
   landingOrigin: undefined as string | undefined,
}));

vi.mock("@/lib/env", () => ({
   get landingOrigin() {
      return h.landingOrigin;
   },
   publicEnv: {
      get siteOrigin() {
         return h.siteOrigin;
      },
   },
}));

const respond = async () => {
   vi.resetModules();
   const { default: handler } = await import("@/pages/api/sitemap");
   const res = {
      statusCode: 0,
      body: "",
      setHeader: vi.fn(),
      status(code: number) {
         this.statusCode = code;
         return this;
      },
      send(body: string) {
         this.body = body;
      },
      end: vi.fn(),
   };
   handler({} as NextApiRequest, res as unknown as NextApiResponse);
   return res;
};

const locs = (body: string) =>
   [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, loc]) => loc);

afterEach(() => {
   h.siteOrigin = "https://app.example.com";
   h.landingOrigin = undefined;
});

describe("the sitemap", () => {
   it("lists only the app's own public page when no landing site is proxied", async () => {
      const res = await respond();
      expect(res.statusCode).toBe(200);
      expect(locs(res.body)).toEqual([
         `https://app.example.com${SITE_PATHS.login}`,
      ]);
   });

   it("lists the landing pages too when they are proxied", async () => {
      h.landingOrigin = "https://landing.internal";
      const res = await respond();
      expect(locs(res.body)).toEqual(
         [...LANDING_ROUTES, SITE_PATHS.login].map(
            (path) => `https://app.example.com${path}`
         )
      );
   });

   it("is not served without a site URL to make the links absolute", async () => {
      h.siteOrigin = "";
      const res = await respond();
      expect(res.statusCode).toBe(404);
      expect(res.end).toHaveBeenCalledOnce();
      expect(res.body).toBe("");
   });
});
