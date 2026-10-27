import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeletionProtectionNotice from "./deletion-protection-notice";

const state = vi.hoisted(() => ({
   protection: "checked" as "checked" | "conditional" | null,
}));

vi.mock("@/lib/hooks/queries/server/useServers", () => ({
   default: () => ({
      currentServer: {
         id: "other",
         capabilities: { deleteProtection: "conditional" },
      },
      servers: [
         { id: "target", capabilities: { deleteProtection: state.protection } },
      ],
   }),
}));

beforeEach(() => {
   state.protection = "checked";
});

describe("deletion protection notice", () => {
   it.each(["delete", "move"] as const)(
      "warns about concurrent changes before %s on the requested server",
      (action) => {
         const markup = renderToStaticMarkup(
            React.createElement(DeletionProtectionNotice, {
               serverId: "target",
               action,
            })
         );
         expect(markup).toContain("file changed during deletion");
         expect(markup).toContain("Pause other writers");
         if (action !== "delete")
            expect(markup).toContain("deletes originals after copying");
      }
   );

   it.each(["conditional", null] as const)(
      "does not misreport %s deletion as a checked fallback",
      (protection) => {
         state.protection = protection;
         expect(
            renderToStaticMarkup(
               React.createElement(DeletionProtectionNotice, {
                  serverId: "target",
                  action: "delete",
               })
            )
         ).toBe("");
      }
   );
});
