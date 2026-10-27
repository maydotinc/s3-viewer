import { formatDay } from "@/lib/utils/format";
import { DAY_MS, SESSION_ABSOLUTE_TTL_DAYS } from "@s3-viewer/shared";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ sessions: [] as unknown[] }));

vi.mock("@/lib/hooks/queries/user/useSessions", () => ({
   useSessions: () => ({ data: h.sessions, isLoading: false, error: null }),
   useRevokeSession: () => ({ isPending: false, mutate: vi.fn() }),
   useRevokeOtherSessions: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("@/lib/auth", () => ({
   authClient: { useSession: () => ({ data: { session: { id: "here" } } }) },
}));
vi.mock("@s3-viewer/ui/components/tooltip", () => ({
   SimpleTooltip: ({ children }: { children: ReactNode }) => children,
}));
import SessionsCard from "./sessions-card";

const at = (days: number) => new Date(Date.now() + days * DAY_MS);
const session = (id: string, signedIn: number, expires: number) => ({
   id,
   token: id,
   createdAt: at(signedIn),
   expiresAt: at(expires),
});
const expiry = (date: Date) => `Expires ${formatDay(date.toISOString())}`;

describe("listed sessions", () => {
   it("end at the absolute cap and drop out once they pass it", () => {
      const capped = session("capped", -85, 30);
      h.sessions = [
         session("here", -1, 6),
         capped,
         session("over", -SESSION_ABSOLUTE_TTL_DAYS - 1, 20),
      ];
      const html = renderToStaticMarkup(createElement(SessionsCard));
      expect(html).toContain(expiry(at(6)));
      expect(html).toContain(
         expiry(
            new Date(
               capped.createdAt.getTime() + SESSION_ABSOLUTE_TTL_DAYS * DAY_MS
            )
         )
      );
      expect(html.split("Expires ").length - 1).toBe(2);
   });

   it("keep this device even when the client clock has passed its end", () => {
      h.sessions = [session("here", -SESSION_ABSOLUTE_TTL_DAYS - 1, -1)];
      const html = renderToStaticMarkup(createElement(SessionsCard));
      expect(html).toContain("This device");
   });
});
