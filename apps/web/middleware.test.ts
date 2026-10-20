import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   landingOrigin: undefined as string | undefined,
}));
vi.mock("@/lib/env", () => ({
   get landingOrigin() {
      return h.landingOrigin;
   },
   publicEnv: {},
}));
vi.mock("@/lib/csp", () => ({
   NONCE_HEADER: "x-nonce",
   contentSecurityPolicy: () => "",
}));

import middleware from "./middleware";

const visit = (path: string) =>
   middleware(new NextRequest(`https://app.test${path}`));

beforeEach(() => {
   h.landingOrigin = undefined;
});

describe("legal page aliases", () => {
   it("redirect to the landing site's legal pages", () => {
      h.landingOrigin = "http://landing.internal";
      const response = visit("/privacy");
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
         "https://app.test/legal/privacy-policy"
      );
   });

   it("are left to the app's own 404 when there is no landing site", () => {
      expect(visit("/privacy").headers.get("location")).toBeNull();
   });
});
