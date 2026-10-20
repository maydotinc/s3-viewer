import { MAX_BUCKET_NAMES, Role, type S3Bucket } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import type { GrantRow } from "../bucket-grants";
import { EMPTY_EMAIL_FIELD } from "./email-chips";
import {
   INITIAL_WIZARD_STATE,
   canContinueAccess,
   checkAccess,
   defaultAccess,
   serverAccessProblem,
   wizardReducer,
   type WizardState,
} from "./wizard-state";

const buckets: S3Bucket[] = ["site", "docs"].map((name) => ({
   name,
   creationDate: null,
   userRole: Role.OWNER,
   folders: null,
}));

const row = (
   bucketName: string,
   folders: string[] | null = null
): GrantRow => ({
   bucketName,
   role: Role.VIEWER,
   folders,
});

const withAccess = (
   state: WizardState,
   serverId: string,
   rows: GrantRow[]
): WizardState =>
   wizardReducer(state, {
      type: "access",
      serverId,
      fallback: defaultAccess(Role.OWNER),
      update: (current) => ({ ...current, rows }),
   });

describe("choosing servers", () => {
   it("keeps the order servers were checked in and drops unchecked ones", () => {
      let state = wizardReducer(INITIAL_WIZARD_STATE, {
         type: "server",
         serverId: "b",
         checked: true,
      });
      state = wizardReducer(state, {
         type: "server",
         serverId: "a",
         checked: true,
      });
      expect(state.selected).toEqual(["b", "a"]);
      state = wizardReducer(state, {
         type: "server",
         serverId: "b",
         checked: false,
      });
      expect(state.selected).toEqual(["a"]);
      state = wizardReducer(state, { type: "servers", serverIds: ["a", "b"] });
      expect(state.selected).toEqual(["a", "b"]);
   });
});

describe("per-server access", () => {
   it("the lowest assignable role is the default", () => {
      expect(defaultAccess(Role.OWNER).role).toBe(Role.VIEWER);
      expect(defaultAccess(Role.ADMIN).role).toBe(Role.VIEWER);
   });

   it("a failed check stores the committed rows, expands the culprit and asks for focus", () => {
      const state = withAccess(INITIAL_WIZARD_STATE, "a", [
         { ...row("site", []), draft: "blog" },
      ]);
      const next = wizardReducer(state, {
         type: "accessChecked",
         committed: { a: [row("site", ["blog/"])] },
         failing: "a",
      });
      expect(next.access.a?.rows).toEqual([row("site", ["blog/"])]);
      expect(next.accessSubmitted).toBe(true);
      expect(next.expanded).toBe("a");
      expect(next.focusRequest).toBe(1);
   });
});

describe("after sending", () => {
   const sent = wizardReducer(
      { ...INITIAL_WIZARD_STATE, step: "review", selected: ["a"] },
      {
         type: "sent",
         result: {
            outcomes: [
               {
                  serverId: "a",
                  invites: [],
                  alreadyMembers: [],
                  error: "Down",
               },
               { serverId: "b", invites: [], alreadyMembers: [], error: null },
            ],
         },
      }
   );

   it("a retry replaces only that server's outcome", () => {
      const next = wizardReducer(sent, {
         type: "outcome",
         outcome: {
            serverId: "a",
            invites: [],
            alreadyMembers: ["x@x.com"],
            error: null,
         },
      });
      expect(next.result?.outcomes.map(({ error }) => error)).toEqual([
         null,
         null,
      ]);
      expect(next.result?.outcomes[0]?.alreadyMembers).toEqual(["x@x.com"]);
   });

   it("inviting more people keeps the servers and access, and only clears the people", () => {
      const state = withAccess(
         { ...sent, emails: { ...EMPTY_EMAIL_FIELD, chips: ["a@x.com"] } },
         "a",
         [row("site")]
      );
      const next = wizardReducer(state, { type: "inviteMore" });
      expect(next.step).toBe("who");
      expect(next.emails).toEqual(EMPTY_EMAIL_FIELD);
      expect(next.result).toBeNull();
      expect(next.selected).toEqual(["a"]);
      expect(next.access.a?.rows).toEqual([row("site")]);
   });
});

describe("judging a server's access", () => {
   const check = { buckets, myRole: Role.OWNER, serverRole: Role.VIEWER };

   it("needs a bucket first", () => {
      expect(serverAccessProblem({ ...check, rows: [] })).toBe(
         "Choose at least one bucket"
      );
      expect(serverAccessProblem({ ...check, rows: [row("site")] })).toBeNull();
   });

   it("names the bucket whose access is wrong", () => {
      expect(serverAccessProblem({ ...check, rows: [row("site", [])] })).toBe(
         "Check the access on site."
      );
      expect(
         serverAccessProblem({
            ...check,
            serverRole: Role.ADMIN,
            rows: [row("site", ["a/"])],
         })
      ).toBe(
         "Admins can't be limited to folders. Choose Whole bucket on site, or a different server role."
      );
   });

   it("refuses more buckets than the API takes", () => {
      const rows = Array.from({ length: MAX_BUCKET_NAMES + 1 }, (_, index) =>
         row(`bucket-${index}`)
      );
      expect(serverAccessProblem({ ...check, rows })).toBe(
         `Choose at most ${MAX_BUCKET_NAMES} buckets`
      );
   });

   it("commits typed folders for every server and points at the first one still wrong", () => {
      const result = checkAccess([
         {
            serverId: "a",
            ...check,
            rows: [{ ...row("site", []), draft: "blog" }],
         },
         { serverId: "b", ...check, rows: [] },
      ]);
      expect(result.committed.a).toEqual([
         { ...row("site", ["blog/"]), draft: "" },
      ]);
      expect(result.failing).toBe("b");
   });
});

describe("the Continue button on Access", () => {
   it("waits for buckets and for every server to have at least one", () => {
      const ready = { rows: [row("site")], isLoading: false, noBuckets: false };
      expect(canContinueAccess([ready])).toBe(true);
      expect(canContinueAccess([ready, { ...ready, isLoading: true }])).toBe(
         false
      );
      expect(canContinueAccess([ready, { ...ready, rows: [] }])).toBe(false);
      expect(
         canContinueAccess([{ rows: [], isLoading: false, noBuckets: true }])
      ).toBe(false);
      expect(canContinueAccess([])).toBe(false);
   });
});
