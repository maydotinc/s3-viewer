import { describe, expect, it } from "vitest";
import {
   DEFAULT_RENAME_OPTIONS,
   MAX_RENAME_PREVIEW_ROWS,
   applyOperation,
   isBlocked,
   normalizeExtension,
   planBulkRename,
   renameKey,
   replaceLiteral,
   splitName,
   toOperation,
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

   it("does not rescan the replacement it just wrote", () => {
      expect(replaceLiteral("aa", "a", "aa", true, true)).toBe("aaaa");
   });

   it.each([false, true])(
      "preserves original Unicode offsets with replace-all=%s",
      (all) => {
         expect(
            replaceLiteral("İfile-file.txt", "file", "data", false, all)
         ).toBe(all ? "İdata-data.txt" : "İdata-file.txt");
         expect(replaceLiteral("aİx-aİx", "aİx", "z", false, all)).toBe(
            all ? "z-z" : "z-aİx"
         );
      }
   );

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
      ["prefix", { kind: "prefix", text: "2026-" }, "2026-report.csv"],
      ["suffix", { kind: "suffix", text: "-v2" }, "report-v2.csv"],
      ["extension", { kind: "extension", extension: "tsv" }, "report.tsv"],
      [
         "extension with dot",
         { kind: "extension", extension: ".tsv" },
         "report.tsv",
      ],
      ["extension removal", { kind: "extension", extension: "  " }, "report"],
   ] as [string, BulkRenameOperation, string][])(
      "applies %s",
      (_label, operation, expected) => {
         expect(applyOperation("report.csv", operation)).toBe(expected);
      }
   );

   it("lowercases the whole name", () => {
      expect(applyOperation("Report FINAL.CSV", { kind: "lowercase" })).toBe(
         "report final.csv"
      );
   });

   it("adds a suffix before a multi-dot extension", () => {
      expect(
         applyOperation("archive.tar.gz", { kind: "suffix", text: "-old" })
      ).toBe("archive.tar-old.gz");
   });

   it("gives an extensionless name one", () => {
      expect(
         applyOperation("README", { kind: "extension", extension: "md" })
      ).toBe("README.md");
   });

   it("normalizes stacked dots", () => {
      expect(normalizeExtension("...json")).toBe(".json");
      expect(normalizeExtension("")).toBe("");
   });
});

describe("renameKey", () => {
   it("only ever rewrites the file name", () => {
      expect(
         renameKey("Invoices/2026/Draft Report.PDF", { kind: "lowercase" })
      ).toBe("Invoices/2026/draft report.pdf");
   });

   it("leaves a root-level key at the root", () => {
      expect(renameKey("report.csv", { kind: "prefix", text: "old-" })).toBe(
         "old-report.csv"
      );
   });

   it("does not match the prefix when replacing", () => {
      expect(renameKey("draft/draft.txt", replace("draft", "final"))).toBe(
         "draft/final.txt"
      );
   });
});

describe("toOperation", () => {
   const fields = {
      find: "DRAFT",
      replacement: "final",
      text: "x",
      extension: "md",
   };

   it("carries only the fields the selected kind reads", () => {
      expect(
         toOperation(fields, {
            kind: "replace",
            matchCase: true,
            allOccurrences: false,
         })
      ).toEqual({
         kind: "replace",
         find: "DRAFT",
         replacement: "final",
         matchCase: true,
         allOccurrences: false,
      });
      expect(
         toOperation(fields, { ...DEFAULT_RENAME_OPTIONS, kind: "prefix" })
      ).toEqual({ kind: "prefix", text: "x" });
      expect(
         toOperation(fields, { ...DEFAULT_RENAME_OPTIONS, kind: "suffix" })
      ).toEqual({ kind: "suffix", text: "x" });
      expect(
         toOperation(fields, { ...DEFAULT_RENAME_OPTIONS, kind: "extension" })
      ).toEqual({ kind: "extension", extension: "md" });
      expect(
         toOperation(fields, { ...DEFAULT_RENAME_OPTIONS, kind: "lowercase" })
      ).toEqual({ kind: "lowercase" });
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

   it("allows a swap chain where both sources move", () => {
      const plan = planBulkRename(["a/one.txt", "a/two.txt"], {
         kind: "prefix",
         text: "x-",
      });
      expect(plan.duplicates).toEqual([]);
      expect(plan.conflicts).toEqual([]);
      expect(isBlocked(plan)).toBe(false);
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

   it("rejects a rename that would empty the name", () => {
      const plan = planBulkRename(["a/one.txt"], replace("one.txt", ""));
      expect(plan.invalid).toEqual([
         {
            key: "a/one.txt",
            newKey: "a/",
            reason: "The key can't end with a slash.",
         },
      ]);
   });

   it("ignores folder markers and duplicate input keys", () => {
      const plan = planBulkRename(["a/", "a/one.txt", "a/one.txt"], {
         kind: "prefix",
         text: "x-",
      });
      expect(plan.rows).toEqual([{ key: "a/one.txt", newKey: "a/x-one.txt" }]);
      expect(plan.unchanged).toBe(0);
   });

   it("plans more rows than the preview shows", () => {
      const many = Array.from(
         { length: MAX_RENAME_PREVIEW_ROWS + 50 },
         (_unused, index) => `a/file-${index}.txt`
      );
      const plan = planBulkRename(many, { kind: "prefix", text: "x-" });
      expect(plan.rows).toHaveLength(MAX_RENAME_PREVIEW_ROWS + 50);
      expect(plan.rows.slice(0, MAX_RENAME_PREVIEW_ROWS)).toHaveLength(
         MAX_RENAME_PREVIEW_ROWS
      );
   });
});
