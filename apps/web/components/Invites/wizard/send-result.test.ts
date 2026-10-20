// @vitest-environment happy-dom
import {
   buttonByText,
   mountedRuntime,
   sentInvite as invite,
   serverInfo,
} from "@/components/test-helpers";
import type { InviteOutcome } from "@s3-viewer/types";
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SendResult from "./send-result";

vi.mock("@/components/Layout/Sidebar/Servers/server-logo", () => ({
   default: () => null,
}));

const servers = [
   serverInfo({ id: "a", name: "Backups" }),
   serverInfo({ id: "b", name: "Media" }),
];

const view = mountedRuntime();
const onRetry = vi.fn();
beforeEach(() => onRetry.mockClear());

const render = async (
   outcomes: InviteOutcome[],
   retrying: string | null = null,
   notified = true
) => {
   await view.mount(
      createElement(SendResult, {
         outcomes,
         servers,
         retrying,
         notified,
         onRetry,
      })
   );
   return view.current.container;
};

describe("mixed outcomes", () => {
   it("tells each server's story in its own row", async () => {
      const container = await render([
         {
            serverId: "a",
            invites: [invite("x@x.com"), invite("y@x.com")],
            alreadyMembers: ["z@x.com"],
            error: null,
         },
         {
            serverId: "b",
            invites: [],
            alreadyMembers: [],
            error: "Too many pending invites",
         },
      ]);
      const rows = [...container.querySelectorAll("li")];
      expect(rows).toHaveLength(2);
      expect(rows[0]!.textContent).toContain("Backups");
      expect(rows[0]!.textContent).toContain("Invited x@x.com and y@x.com");
      expect(rows[0]!.textContent).toContain("z@x.com is already a member");
      expect(rows[1]!.textContent).toContain("Media");
      expect(rows[1]!.querySelector("[role=alert]")!.textContent).toContain(
         "Too many pending invites"
      );
      expect(container.querySelector("[role=status]")).not.toBeNull();
      expect(container.textContent).not.toContain("no email went");
   });

   it("resends to the failed server only", async () => {
      const container = await render([
         { serverId: "b", invites: [], alreadyMembers: [], error: "Down" },
      ]);
      await act(async () => buttonByText(container, "Try again")!.click());
      expect(onRetry).toHaveBeenCalledExactlyOnceWith("b");
   });

   it("shows the retry in progress on that row", async () => {
      const container = await render(
         [{ serverId: "b", invites: [], alreadyMembers: [], error: "Down" }],
         "b"
      );
      expect(buttonByText(container, "Try again")!.disabled).toBe(true);
   });
});

describe("invites saved without an email", () => {
   it("explains what those people should do", async () => {
      const container = await render([
         {
            serverId: "a",
            invites: [invite("x@x.com", false), invite("y@x.com")],
            alreadyMembers: [],
            error: null,
         },
      ]);
      expect(container.textContent).toContain(
         "Saved, but no email went to x@x.com. Ask them to sign in with that address and open Settings, Invitations."
      );
   });
});
