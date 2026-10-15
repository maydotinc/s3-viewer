import { describe, expect, it } from "vitest";
import {
   applyOperation,
   isBlocked,
   planBulkRename,
   renameKey,
   replaceLiteral,
   splitName,
   type BulkRenameOperation,
} from "./bulk-rename";

const replace = (
   find: string,
   replacement: string,
   matchCase = true,
   allOccurrences = false
): BulkRenameOperation => ({
   kind: "replace",
   find,
   replacement,
   matchCase,
   allOccurrences,
});

describe("splitName", () => {
   it.each([
      ["report.csv", "report", ".csv"],
      ["archive.tar.gz", "archive.tar", ".gz"],
      ["README", "README", ""],
      [".env", ".env", ""],
      ["notes.", "notes", "."],
   ])("splits %s", (name, stem, extension) => {
      expect(splitName(name)).toEqual({ stem, extension });
   });
});

describe("replaceLiteral", () => {
   it("replaces only the first occurrence by default", () => {
      expect(replaceLiteral("a-a-a", "a", "b", true, false)).toBe("b-a-a");
   });

   it("replaces every occurrence when asked", () => {
      expect(replaceLiteral("a-a-a", "a", "b", true, true)).toBe("b-b-b");
   });

   it("matches case-insensitively while keeping the untouched text verbatim", () => {
      expect(
         replaceLiteral("Draft-DRAFT-draft", "draft", "final", false, true)
      ).toBe("final-final-final");
      expect(replaceLiteral("Draft-report", "draft", "final", true, true)).toBe(
         "Draft-report"
      );
   });

   it("treats the needle as a literal, not a pattern", () => {
      expect(replaceLiteral("a.b.c", ".", "_", true, true)).toBe("a_b_c");
      expect(replaceLiteral("file(1).txt", "(1)", "", true, true)).toBe(
         "file.txt"
      );
   });

   it("never loops on an empty needle", () => {
      expect(replaceLiteral("keep", "", "x", true, true)).toBe("keep");
   });

   it("uses Unicode simple case folding without matching expanded lowercase sequences", () => {
      expect(replaceLiteral("ſ-K-Σ-ς", "s", "x", false, true)).toBe("x-K-Σ-ς");
      expect(replaceLiteral("İ-i-i̇", "İ", "x", false, true)).toBe("x-i-i̇");
      expect(replaceLiteral("😀İfile.txt", "file", "data", false, true)).toBe(
         "😀İdata.txt"
      );
   });

   it("keeps replacement dollar sequences literal", () => {
      expect(replaceLiteral("A-A", "a", "$&$`$'$$", false, true)).toBe(
         "$&$`$'$$-$&$`$'$$"
      );
   });
});

describe("applyOperation", () => {
   it.each([
      [
         "prefix",
         "report.csv",
         { kind: "prefix", text: "2026-" },
         "2026-report.csv",
      ],
      [
         "suffix",
         "report.csv",
         { kind: "suffix", text: "-v2" },
         "report-v2.csv",
      ],
      [
         "suffix before a multi-dot extension",
         "archive.tar.gz",
         { kind: "suffix", text: "-old" },
         "archive.tar-old.gz",
      ],
      [
         "extension",
         "report.csv",
         { kind: "extension", extension: "tsv" },
         "report.tsv",
      ],
      [
         "extension with stacked dots",
         "report.csv",
         { kind: "extension", extension: "...json" },
         "report.json",
      ],
      [
         "extension to an extensionless name",
         "README",
         { kind: "extension", extension: "md" },
         "README.md",
      ],
      [
         "extension removal",
         "report.csv",
         { kind: "extension", extension: "  " },
         "report",
      ],
   ] as [string, string, BulkRenameOperation, string][])(
      "applies %s",
      (_label, name, operation, expected) => {
         expect(applyOperation(name, operation)).toBe(expected);
      }
   );
});

describe("renameKey", () => {
   it("does not match the prefix when replacing", () => {
      expect(renameKey("draft/draft.txt", replace("draft", "final"))).toBe(
         "draft/final.txt"
      );
   });
});

describe("planBulkRename", () => {
   const keys = ["a/one.txt", "a/two.txt", "a/keep.md"];

   it("skips rows the operation does not change", () => {
      const plan = planBulkRename(keys, replace(".txt", ".csv"));
      expect(plan.rows).toEqual([
         { key: "a/one.txt", newKey: "a/one.csv" },
         { key: "a/two.txt", newKey: "a/two.csv" },
      ]);
      expect(plan.unchanged).toBe(1);
      expect(isBlocked(plan)).toBe(false);
   });

   it("blocks a plan that changes nothing", () => {
      const plan = planBulkRename(keys, replace("nothing", "x"));
      expect(plan.rows).toHaveLength(0);
      expect(plan.unchanged).toBe(3);
      expect(isBlocked(plan)).toBe(true);
   });

   it("flags two rows claiming the same target", () => {
      const plan = planBulkRename(["a/Report.csv", "a/REPORT.csv"], {
         kind: "lowercase",
      });
      expect(plan.duplicates).toEqual(["a/report.csv"]);
      expect(isBlocked(plan)).toBe(true);
   });

   it("flags a target already held by an object this run leaves alone", () => {
      const plan = planBulkRename(
         ["a/draft.txt", "a/final.txt"],
         replace("draft", "final")
      );
      expect(plan.rows).toEqual([
         { key: "a/draft.txt", newKey: "a/final.txt" },
      ]);
      expect(plan.duplicates).toEqual(["a/final.txt"]);
   });

   it("flags a target this same run renames away", () => {
      const plan = planBulkRename(["a.txt", "xa.txt"], {
         kind: "prefix",
         text: "x",
      });
      expect(plan.rows).toEqual([
         { key: "a.txt", newKey: "xa.txt" },
         { key: "xa.txt", newKey: "xxa.txt" },
      ]);
      expect(plan.conflicts).toEqual(["xa.txt"]);
      expect(plan.duplicates).toEqual([]);
      expect(isBlocked(plan)).toBe(true);
   });

   it("rejects a target that is not a usable key", () => {
      const plan = planBulkRename(["a/one.txt"], {
         kind: "prefix",
         text: "../",
      });
      expect(plan.rows).toHaveLength(0);
      expect(plan.invalid).toEqual([
         {
            key: "a/one.txt",
            newKey: "a/../one.txt",
            reason: 'The key can\'t contain empty, "." or ".." segments.',
         },
      ]);
      expect(isBlocked(plan)).toBe(true);
   });

   it("rejects a new name that would move the file into another folder", () => {
      const plan = planBulkRename(["a/one.txt"], replace("one", "b/one"));
      expect(plan.invalid).toEqual([
         {
            key: "a/one.txt",
            newKey: "a/b/one.txt",
            reason: "The new name can't contain a slash.",
         },
      ]);
      expect(isBlocked(plan)).toBe(true);
   });

   it("ignores folder markers and duplicate input keys", () => {
      const plan = planBulkRename(["a/", "a/one.txt", "a/one.txt"], {
         kind: "prefix",
         text: "x-",
      });
      expect(plan.rows).toEqual([{ key: "a/one.txt", newKey: "a/x-one.txt" }]);
      expect(plan.unchanged).toBe(0);
   });
});
