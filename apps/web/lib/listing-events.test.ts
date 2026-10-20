import { describe, expect, it } from "vitest";
import { changeReaches } from "./listing-events";

const upload = { serverId: "s", bucketName: "b", keys: ["p/a.txt"] };
const at = (prefix: string, serverId = "s", bucketName = "b") => ({
   serverId,
   bucketName,
   prefix,
});

describe("which open listing a change reloads", () => {
   it.each([
      [at(""), true],
      [at("p/"), true],
      [at("p/sub/"), false],
      [at("archive/"), false],
      [at("p/", "other"), false],
      [at("p/", "s", "other"), false],
   ])("an upload to p/ reaches %j: %s", (scope, reaches) => {
      expect(changeReaches(upload, scope)).toBe(reaches);
   });

   it("reloads every listing for a change with no scope", () => {
      expect(changeReaches(undefined, at("p/sub/", "other"))).toBe(true);
   });
});
