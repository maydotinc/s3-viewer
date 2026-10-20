import { logger } from "@/lib/logger";
import express, { type Request } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { untrustedProxyWarning } from "./untrusted-proxy";

const requestFrom = (
   trustProxy: string | number,
   remoteAddress: string,
   forwardedFor?: string
): Request => {
   const app = express();
   app.set("trust proxy", trustProxy);
   return {
      app,
      headers:
         forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor },
      socket: { remoteAddress },
   } as unknown as Request;
};

const run = (
   middleware: ReturnType<typeof untrustedProxyWarning>,
   req: Request
) => {
   const next = vi.fn();
   void middleware(req, {} as never, next);
   expect(next).toHaveBeenCalledOnce();
};

describe("untrustedProxyWarning", () => {
   afterEach(() => vi.restoreAllMocks());

   it("warns once when a peer TRUST_PROXY does not trust forwards a client address", () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      const middleware = untrustedProxyWarning();
      run(middleware, requestFrom("loopback", "10.0.0.7", "203.0.113.9"));
      run(middleware, requestFrom("loopback", "10.0.0.8", "203.0.113.10"));
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0]?.[0]).toMatch(/10\.0\.0\.7.*TRUST_PROXY/);
   });

   it.each([
      ["a trusted loopback proxy", "loopback", "127.0.0.1", "203.0.113.9"],
      ["a proxy covered by a hop count", 1, "10.0.0.7", "203.0.113.9"],
      ["a direct client", "loopback", "203.0.113.9", undefined],
   ])("stays quiet for %s", (_name, trustProxy, peer, forwardedFor) => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      run(untrustedProxyWarning(), requestFrom(trustProxy, peer, forwardedFor));
      expect(warn).not.toHaveBeenCalled();
   });
});
