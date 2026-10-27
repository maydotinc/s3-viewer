import express from "express";
import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "@/lib/http";
import { routeServer, signedIn } from "@/lib/testing/route-harness";

const USER = "user123456";

const state = vi.hoisted(() => ({
   calls: [] as string[],
   setPassword: vi.fn(),
   revokeOtherSessions: vi.fn(),
   dropResetLinks: vi.fn(),
}));

vi.mock("@s3-viewer/auth", () => ({
   auth: {
      api: {
         setPassword: state.setPassword,
         revokeOtherSessions: state.revokeOtherSessions,
      },
   },
   dropResetLinks: state.dropResetLinks,
}));

vi.mock("@/lib/services/account", () => ({ accountSummary: vi.fn() }));

const { accountRouter } = await import("./account");

let base: string;
routeServer(
   (app) => {
      app.use(express.json());
      app.use(signedIn(() => ({ id: USER })));
      app.use((req, _res, next) => {
         Object.assign(req, { session: { createdAt: new Date() } });
         next();
      });
      app.use("/account", accountRouter);
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/account`;
   }
);

beforeEach(() => {
   state.calls = [];
   state.setPassword.mockReset().mockImplementation(async () => {
      state.calls.push("setPassword");
   });
   state.revokeOtherSessions.mockReset().mockImplementation(async () => {
      state.calls.push("revokeOtherSessions");
   });
   state.dropResetLinks.mockReset().mockImplementation(async () => {
      state.calls.push("dropResetLinks");
   });
});

const setPassword = () =>
   fetch(`${base}/password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "unique-test-password-2026" }),
   });

describe("POST /account/password", () => {
   it("drops the user's outstanding reset links once the password is set", async () => {
      const res = await setPassword();
      expect(res.status).toBe(204);
      expect(state.dropResetLinks).toHaveBeenCalledWith(USER);
      expect(state.calls).toEqual([
         "setPassword",
         "dropResetLinks",
         "revokeOtherSessions",
      ]);
   });

   it("still revokes the other sessions when dropping the links fails", async () => {
      state.dropResetLinks.mockRejectedValue(new Error("pool timeout"));
      const res = await setPassword();
      expect(res.status).toBe(500);
      expect(state.revokeOtherSessions).toHaveBeenCalledTimes(1);
   });

   it("keeps reset links when setting the password fails", async () => {
      state.setPassword.mockRejectedValue(
         new APIError("BAD_REQUEST", { message: "user already has a password" })
      );
      const res = await setPassword();
      expect(res.status).toBe(400);
      expect(state.dropResetLinks).not.toHaveBeenCalled();
      expect(state.revokeOtherSessions).not.toHaveBeenCalled();
   });
});
