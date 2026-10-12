import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
   siteOrigin: "https://app.example.com",
}));

const { originCheck, strictOriginCheck } = await import("./origin");

const run = (
   handler: typeof originCheck,
   headers: Record<string, string | undefined>,
   method = "GET"
) => {
   const req = {
      method,
      get: (name: string) => headers[name.toLowerCase()],
   };
   const res = { status: vi.fn(), json: vi.fn() };
   res.status.mockReturnValue(res);
   const next = vi.fn();
   handler(req as unknown as Request, res as unknown as Response, next);
   return { res, next };
};

describe("originCheck", () => {
   it("passes a same-origin POST", () => {
      const { res, next } = run(
         originCheck,
         { origin: "https://app.example.com" },
         "POST"
      );
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
   });

   it("passes a POST with no Origin header when Sec-Fetch-Site says same-origin", () => {
      const { res, next } = run(
         originCheck,
         { "sec-fetch-site": "same-origin" },
         "POST"
      );
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
   });

   it("blocks a cross-site POST", () => {
      const { res, next } = run(
         originCheck,
         { origin: "https://evil.example" },
         "POST"
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
   });

   it("exempts GET, HEAD and OPTIONS regardless of origin", () => {
      for (const method of ["GET", "HEAD", "OPTIONS"]) {
         const { res, next } = run(
            originCheck,
            { origin: "https://evil.example" },
            method
         );
         expect(next).toHaveBeenCalledOnce();
         expect(res.status).not.toHaveBeenCalled();
      }
   });
});

describe("strictOriginCheck", () => {
   it("blocks a cross-site GET that a plain <img src> or navigation could trigger", () => {
      const { res, next } = run(
         strictOriginCheck,
         { origin: "https://evil.example" },
         "GET"
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
         message: "Cross-site request blocked",
         code: "ORIGIN",
      });
   });

   it("blocks a cross-site GET with no Origin header and no same-origin Sec-Fetch-Site", () => {
      const { res, next } = run(strictOriginCheck, {}, "GET");
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
   });

   it("passes a same-origin GET", () => {
      const { res, next } = run(
         strictOriginCheck,
         { origin: "https://app.example.com" },
         "GET"
      );
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
   });

   it("passes a GET with no Origin header when Sec-Fetch-Site says same-origin", () => {
      const { res, next } = run(
         strictOriginCheck,
         { "sec-fetch-site": "same-origin" },
         "GET"
      );
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
   });
});
