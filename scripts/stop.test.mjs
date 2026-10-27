import { describe, expect, it } from "vitest";
import { composeStopOutcome } from "./stop.mjs";

describe("composeStopOutcome", () => {
   it("treats a missing docker binary as nothing to stop", () => {
      const spawnFailed = {
         status: null,
         error: Object.assign(new Error("spawn docker ENOENT"), {
            code: "ENOENT",
         }),
      };
      expect(composeStopOutcome(spawnFailed)).toEqual({
         code: 0,
         message: expect.stringContaining("Docker isn't available"),
      });
      expect(composeStopOutcome({ status: null })).toMatchObject({ code: 0 });
   });

   it("stays quiet without docker when the setup never used it", () => {
      expect(
         composeStopOutcome({ status: null }, { dockerless: true })
      ).toEqual({ code: 0, message: null });
      expect(composeStopOutcome({ status: 1 }, { dockerless: true })).toEqual({
         code: 0,
         message: null,
      });
   });

   it("fails when docker was killed before it finished stopping", () => {
      const killed = { status: null, signal: "SIGTERM" };
      expect(composeStopOutcome(killed)).toEqual({
         code: 1,
         message: expect.stringContaining("SIGTERM"),
      });
      expect(composeStopOutcome(killed, { dockerless: true })).toMatchObject({
         code: 1,
      });
   });

   it("fails when docker ran but couldn't stop the services", () => {
      expect(composeStopOutcome({ status: 1 })).toEqual({
         code: 1,
         message: expect.stringContaining("Couldn't stop the docker services"),
      });
   });

   it("succeeds when compose stopped everything", () => {
      expect(composeStopOutcome({ status: 0 })).toEqual({
         code: 0,
         message: null,
      });
   });
});
