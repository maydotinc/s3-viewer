import { MAX_INVITE_EMAILS } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import {
   EMPTY_EMAIL_FIELD,
   addEmails,
   canContinue,
   commitInput,
   helperMessage,
   popChip,
   requireEmails,
   setInput,
   type EmailField,
} from "./email-chips";

const field = (chips: string[], input = ""): EmailField => ({
   chips,
   input,
   feedback: null,
});

const many = Array.from(
   { length: MAX_INVITE_EMAILS },
   (_, index) => `person${index}@example.com`
);

describe("adding addresses", () => {
   it("splits a pasted list on commas, semicolons and whitespace and normalises each", () => {
      const next = addEmails(
         EMPTY_EMAIL_FIELD,
         " A@X.com, b@x.com;c@x.com\nd@x.com "
      );
      expect(next.chips).toEqual(["a@x.com", "b@x.com", "c@x.com", "d@x.com"]);
      expect(next.input).toBe("");
      expect(next.feedback).toBeNull();
   });

   it("keeps an invalid address as a chip so it can be seen and fixed", () => {
      expect(addEmails(EMPTY_EMAIL_FIELD, "not-an-email").chips).toEqual([
         "not-an-email",
      ]);
   });

   it("skips a duplicate, clears the input and says so quietly", () => {
      const next = addEmails(field(["a@x.com"]), "A@x.com");
      expect(next.chips).toEqual(["a@x.com"]);
      expect(next.input).toBe("");
      expect(next.feedback).toEqual({
         tone: "notice",
         text: "a@x.com is already in the list",
      });
   });

   it("stops at the limit and leaves the rest in the input", () => {
      const next = addEmails(
         field(many.slice(0, 4)),
         "e@x.com f@x.com, g@x.com"
      );
      expect(next.chips).toHaveLength(MAX_INVITE_EMAILS);
      expect(next.chips.at(-1)).toBe("e@x.com");
      expect(next.input).toBe("f@x.com, g@x.com");
      expect(next.feedback).toEqual({
         tone: "error",
         text: `You can invite up to ${MAX_INVITE_EMAILS} people at a time`,
      });
   });

   it("commits whatever is typed, and nothing when the input is blank", () => {
      const typed = field(["a@x.com"], " b@x.com ");
      expect(commitInput(typed).chips).toEqual(["a@x.com", "b@x.com"]);
      const blank = field(["a@x.com"], "  ");
      expect(commitInput(blank)).toBe(blank);
   });
});

describe("editing", () => {
   it("backspace in an empty input pulls the last chip back for editing", () => {
      expect(popChip(field(["a@x.com", "b@x.com"]))).toEqual({
         chips: ["a@x.com"],
         input: "b@x.com",
         feedback: null,
      });
   });

   it("backspace with text in the input leaves the chips alone", () => {
      const typed = field(["a@x.com"], "b");
      expect(popChip(typed)).toBe(typed);
   });

   it("typing clears the last message", () => {
      const limited = addEmails(field(many), "z@x.com");
      expect(setInput(limited, "z@x.co").feedback).toBeNull();
   });
});

describe("the helper line", () => {
   it("shows the hint when there is nothing to report", () => {
      expect(helperMessage(EMPTY_EMAIL_FIELD)).toEqual({
         tone: "notice",
         text: "Press Enter after each address, or paste a list.",
      });
   });

   it("flags invalid chips live, over any notice", () => {
      const next = addEmails(field(["bad"]), "bad");
      expect(helperMessage(next)).toEqual({
         tone: "error",
         text: "Check the highlighted addresses",
      });
   });

   it("asks for an address when Enter is pressed on an empty field", () => {
      expect(helperMessage(requireEmails(EMPTY_EMAIL_FIELD))).toEqual({
         tone: "error",
         text: "Enter at least one email address",
      });
   });
});

describe("continuing", () => {
   it("needs at least one valid chip", () => {
      expect(canContinue(EMPTY_EMAIL_FIELD)).toBe(false);
      expect(canContinue(field([], "a@x.com"))).toBe(false);
      expect(canContinue(field(["bad"]))).toBe(false);
      expect(canContinue(field(["a@x.com"]))).toBe(true);
   });

   it("allows pending text only when it would become a valid chip within the limit", () => {
      expect(canContinue(field(["a@x.com"], "b@x.com"))).toBe(true);
      expect(canContinue(field(["a@x.com"], "nope"))).toBe(false);
      expect(canContinue(field(many, "z@x.com"))).toBe(false);
      expect(canContinue(field(many, many[0]!))).toBe(true);
   });
});
