import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { post: h.post },
   apiUrl: (path: string) => `https://api.example.test${path}`,
}));

import { archiveUrl, requestArchive } from "./archive";

beforeEach(() => {
   h.post.mockReset();
   h.post.mockResolvedValue({
      token: "tok",
      expiresAt: "2026-09-07T00:05:00.000Z",
      filename: "photos.zip",
   });
});

describe("requestArchive", () => {
   it("posts the reviewed keys with the expected user", async () => {
      const keys = ["photos/", "notes.txt"];
      await requestArchive("server 1", "my bucket", "user1", keys);
      expect(h.post).toHaveBeenCalledWith(
         "/servers/server%201/buckets/my%20bucket/objects/v3/archive",
         { expectedUserId: "user1", objectKeys: keys },
         undefined
      );
   });

   it("copies the keys instead of sending the caller's array", async () => {
      const keys = ["a.txt"];
      await requestArchive("s", "b", "u", keys);
      expect(h.post.mock.calls[0]?.[1].objectKeys).not.toBe(keys);
   });

   it("passes the abort signal through", async () => {
      const signal = new AbortController().signal;
      await requestArchive("s", "b", "u", ["a.txt"], signal);
      expect(h.post.mock.calls[0]?.[2]).toBe(signal);
   });
});

describe("archiveUrl", () => {
   it("points at the api origin so the session cookie is sent", () => {
      expect(archiveUrl("s", "b", "tok")).toBe(
         "https://api.example.test/servers/s/buckets/b/objects/v3/archive/tok"
      );
   });

   it("escapes a token that is not url-safe", () => {
      expect(archiveUrl("s", "b", "a/b?c")).toContain("/archive/a%2Fb%3Fc");
   });
});
