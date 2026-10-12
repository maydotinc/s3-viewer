import { describe, expect, it, vi } from "vitest";
import {
   destinationKey,
   validateDestination,
   validateFolderKey,
   validateFolderName,
   validateObjectKey,
} from "./keys";

describe("new key form validation", () => {
   it.each(["bad\tname", "bad\ud800name", "a\0b"])(
      "rejects invalid encoding and control characters before submission",
      (key) => {
         expect(validateObjectKey(key)).not.toBeNull();
         expect(validateFolderKey(`${key}/`)).not.toBeNull();
         expect(validateFolderName(key)).not.toBeNull();
      }
   );
   it("counts the whole prefix and filename in UTF-8 bytes", () => {
      expect(validateObjectKey(`p/${"é".repeat(511)}`)).toBeNull();
      expect(validateObjectKey(`p/${"é".repeat(512)}`)).not.toBeNull();
      expect(validateFolderKey(`p/${"é".repeat(510)}a/`)).toBeNull();
      expect(validateFolderKey(`p/${"é".repeat(511)}a/`)).not.toBeNull();
   });
});

describe("where an object lands at a destination", () => {
   it("keeps the path below a moved or copied folder", () => {
      expect(
         destinationKey("raw/deep/a.txt", { folderKey: "raw/" }, "archive/")
      ).toBe("archive/deep/a.txt");
      expect(destinationKey("raw/a.txt", { folderKey: "raw/" }, "")).toBe(
         "a.txt"
      );
   });

   it("keeps only the name of a picked object", () => {
      expect(
         destinationKey("raw/deep/a.txt", { objects: [] }, "archive/")
      ).toBe("archive/a.txt");
      expect(destinationKey("raw/deep/a.txt", { objects: [] }, "")).toBe(
         "a.txt"
      );
   });
});

describe("validating where a move or copy goes", () => {
   const folder = { folderKey: "raw/deep/" };
   const picked = {
      prefix: "raw/",
      objects: [{ key: "raw/a.txt" }, { key: "raw/deep/b.txt" }],
   };

   it("refuses a folder's own key or one that overlaps it", () => {
      expect(validateDestination(folder, "raw/deep/")).toBe(
         "That's the current folder."
      );
      expect(validateDestination(folder, "raw/")).toBe(
         "Source and destination folders must not overlap."
      );
      expect(validateDestination(folder, "raw/deep/more/")).toBe(
         "Source and destination folders must not overlap."
      );
      expect(validateDestination(folder, "archive/")).toBeNull();
   });

   it("checks the folder key's shape before anything else", () => {
      expect(validateDestination(folder, "")).toBe("Enter a folder.");
      expect(validateDestination(folder, "archive")).toBe(
         "The folder has to end with a slash."
      );
      expect(validateDestination(picked, "archive")).toBe(
         "The folder has to end with a slash."
      );
   });

   it("allows the same folder key in another bucket and defers overlap to the caller", () => {
      const overlaps = vi.fn(() => false);
      expect(
         validateDestination(folder, "raw/deep/", {
            sameBucket: false,
            overlaps,
         })
      ).toBeNull();
      expect(overlaps).toHaveBeenCalledExactlyOnceWith(
         "raw/deep/",
         "raw/deep/"
      );
      expect(
         validateDestination(folder, "raw/", { overlaps: () => true })
      ).toBe("Source and destination folders must not overlap.");
   });

   it("refuses the folder picked objects already sit in, but only in the same bucket", () => {
      expect(validateDestination(picked, "raw/")).toBe(
         "That's the current folder."
      );
      expect(
         validateDestination(picked, "raw/", { sameBucket: false })
      ).toBeNull();
      expect(validateDestination(picked, "archive/")).toBeNull();
      expect(validateDestination(picked, "")).toBeNull();
   });

   it("validates each picked object's destination key", () => {
      expect(
         validateDestination(
            { prefix: "", objects: [{ key: `${"é".repeat(600)}` }] },
            "p/"
         )
      ).toBe("Use a valid key of at most 1,024 UTF-8 bytes.");
   });
});
