import { describe, expect, it } from "vitest";
import { failureOf, pinFailure } from "./list-failure";

const a = { id: "a" };
const b = { id: "b" };
const boom = new Error("boom");

describe("pinFailure", () => {
   it("records an error from the live datasource", () => {
      expect(pinFailure(null, a, a, boom)).toEqual({ source: a, error: boom });
   });

   it("ignores an error from a superseded datasource", () => {
      const current = { source: b, error: boom };
      expect(pinFailure(current, b, a, new Error("late"))).toBe(current);
      expect(pinFailure(null, b, a, boom)).toBeNull();
   });

   it("ignores everything before a datasource is live", () => {
      expect(pinFailure(null, null, a, boom)).toBeNull();
   });
});

describe("failureOf", () => {
   it("only surfaces a failure against its own datasource", () => {
      const failure = { source: a, error: boom };
      expect(failureOf(failure, a)).toBe(boom);
      expect(failureOf(failure, b)).toBeNull();
      expect(failureOf(null, a)).toBeNull();
   });
});
