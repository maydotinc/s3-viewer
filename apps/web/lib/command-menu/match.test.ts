import { describe, expect, it } from "vitest";
import {
   matchFields,
   matchSubstring,
   matchText,
   mergeRanges,
   segmentText,
} from "./match";

const scoreOf = (text: string, term: string): number =>
   matchText(text, term)?.score ?? -1;

describe("matchText", () => {
   it("returns null when the characters are not all present", () => {
      expect(matchText("backups", "xyz")).toBeNull();
      expect(matchText("backups", "spuck")).toBeNull();
   });

   it("returns null for an empty term", () => {
      expect(matchText("backups", "")).toBeNull();
      expect(matchText("backups", "   ")).toBeNull();
   });

   it("ranks exact over prefix over boundary over substring over subsequence", () => {
      expect(scoreOf("logs", "logs")).toBeGreaterThan(
         scoreOf("logs-archive", "logs")
      );
      expect(scoreOf("logs-archive", "arch")).toBeGreaterThan(
         scoreOf("searcharchive", "arch")
      );
      expect(scoreOf("searcharchive", "arch")).toBeGreaterThan(
         scoreOf("a-r-c-h", "arch")
      );
   });

   it("is case insensitive", () => {
      expect(scoreOf("Create bucket", "CREATE")).toBe(
         scoreOf("create bucket", "create")
      );
   });

   it("prefers an earlier hit of the same tier", () => {
      expect(scoreOf("ab-target", "target")).toBeGreaterThan(
         scoreOf("abcdefghij-target", "target")
      );
   });

   it("treats a camelCase hump as a word boundary", () => {
      expect(scoreOf("myBucketName", "bucket")).toBeGreaterThan(
         scoreOf("mybucketname", "bucket")
      );
   });

   it("prefers a boundary hit over an earlier mid-word hit", () => {
      const match = matchText("reuploads/uploads", "upload");
      expect(match?.ranges).toEqual([{ start: 10, end: 16 }]);
   });

   it("penalises a scattered subsequence more than a tight one", () => {
      expect(scoreOf("abcd", "ad")).toBeGreaterThan(
         scoreOf("axxxxxxxxxxxxd", "ad")
      );
   });

   it("caps the penalty so tiers never invert", () => {
      const veryLate = scoreOf(`${"x".repeat(400)}logs`, "logs");
      const scattered = scoreOf("l-o-g-s", "logs");
      expect(veryLate).toBeGreaterThan(scattered);
   });

   it("merges adjacent characters of a subsequence into one range", () => {
      expect(matchText("delete objects", "delob")?.ranges).toEqual([
         { start: 0, end: 3 },
         { start: 7, end: 9 },
      ]);
   });
});

describe("mergeRanges", () => {
   it("sorts and merges overlapping ranges", () => {
      expect(
         mergeRanges([
            { start: 5, end: 8 },
            { start: 0, end: 2 },
            { start: 1, end: 4 },
         ])
      ).toEqual([
         { start: 0, end: 4 },
         { start: 5, end: 8 },
      ]);
   });

   it("leaves the input untouched", () => {
      const ranges = [
         { start: 5, end: 8 },
         { start: 0, end: 2 },
         { start: 1, end: 4 },
      ];
      mergeRanges(ranges);
      expect(ranges).toEqual([
         { start: 5, end: 8 },
         { start: 0, end: 2 },
         { start: 1, end: 4 },
      ]);
   });
});

describe("matchFields", () => {
   it("requires every term to land somewhere", () => {
      expect(
         matchFields("Create bucket", "new add", ["create", "add"])
      ).not.toBeNull();
      expect(
         matchFields("Create bucket", "new add", ["create", "missing"])
      ).toBeNull();
   });

   it("matches a term on keywords alone", () => {
      const match = matchFields("Sign out", "log out exit", ["exit"]);
      expect(match).not.toBeNull();
      expect(match?.ranges).toEqual([]);
   });

   it("weights a label hit above the same hit in keywords", () => {
      const onLabel = matchFields("Invites", "people", ["invites"]);
      const onKeywords = matchFields("Members", "invites", ["invites"]);
      expect(onLabel?.score).toBeGreaterThan(onKeywords?.score ?? 0);
   });

   it("keeps one and two term queries on the same scale", () => {
      const one = matchFields("Go to settings", "", ["settings"]);
      const two = matchFields("Go to settings", "", ["go", "settings"]);
      expect(Math.abs((one?.score ?? 0) - (two?.score ?? 0))).toBeLessThan(100);
   });

   it("merges the ranges of every term", () => {
      expect(
         matchFields("Go to settings", "", ["go", "settings"])?.ranges
      ).toEqual([
         { start: 0, end: 2 },
         { start: 6, end: 14 },
      ]);
   });
});

describe("segmentText", () => {
   it("returns the whole string unmatched when there are no ranges", () => {
      expect(segmentText("Dashboard", [])).toEqual([
         { text: "Dashboard", matched: false },
      ]);
   });

   it("alternates plain and matched runs", () => {
      expect(segmentText("prod-logs", [{ start: 5, end: 9 }])).toEqual([
         { text: "prod-", matched: false },
         { text: "logs", matched: true },
      ]);
   });

   it("handles several ranges", () => {
      expect(
         segmentText("Go to settings", [
            { start: 0, end: 2 },
            { start: 6, end: 14 },
         ])
      ).toEqual([
         { text: "Go", matched: true },
         { text: " to ", matched: false },
         { text: "settings", matched: true },
      ]);
   });

   it("clamps ranges that run past the end of the text", () => {
      expect(segmentText("logs", [{ start: 2, end: 99 }])).toEqual([
         { text: "lo", matched: false },
         { text: "gs", matched: true },
      ]);
   });
});

describe("matchSubstring", () => {
   it("refuses a scattered hit that matchText accepts", () => {
      expect(
         matchText("hide show collapse expand panel navigation", "cont")
      ).not.toBeNull();
      expect(
         matchSubstring("hide show collapse expand panel navigation", "cont")
      ).toBeNull();
   });
});
