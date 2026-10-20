import { GITHUB_ISSUES_URL } from "@s3-viewer/types";
import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
   siteOrigin: "https://viewer.example",
   hasLanding: false,
}));
vi.mock("./env", () => ({ publicEnv: env }));

import { supportUrl } from "./site-config";

describe("support link", () => {
   it("opens the landing site's contact page, or GitHub issues without one", () => {
      expect(supportUrl()).toBe(GITHUB_ISSUES_URL);
      env.hasLanding = true;
      expect(supportUrl()).toBe("https://viewer.example/contact");
   });
});
