import { serverInfo } from "@/components/test-helpers";
import { Role, type ServerInfo } from "@s3-viewer/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ servers: [] as unknown[] }));

vi.mock("@/lib/hooks/queries/server/useServers", () => ({
   default: () => ({ servers: h.servers }),
}));
import ActivityRecordingCard from "./activity-recording-card";

const server = (
   name: string,
   enabled: boolean,
   userRole: Role = Role.VIEWER
): ServerInfo =>
   serverInfo({
      id: name,
      name,
      userRole,
      audit: { enabled, canView: false, canManage: false, canVerify: false },
   });

const render = (servers: ServerInfo[]) => {
   h.servers = servers;
   return renderToStaticMarkup(createElement(ActivityRecordingCard)).replace(
      /<[^>]+>/g,
      ""
   );
};

describe("activity recording notice", () => {
   it("keeps a truthful empty state while no server records", () => {
      expect(render([])).toContain(
         "None of your shared servers record activity."
      );
      expect(render([server("Acme storage", false)])).toContain(
         "None of your shared servers record activity."
      );
   });

   it("names only the servers that record", () => {
      const text = render([
         server("Acme storage", true),
         server("Scratch", false),
         server("Backups", true),
      ]);
      expect(text).toContain(
         "these servers records what you do on them through S3 Viewer: Acme storage, Backups."
      );
      expect(text).not.toContain("Scratch");
   });

   it("leaves out servers the reader owns, since they are the one recording", () => {
      expect(render([server("Mine", true, Role.OWNER)])).toContain(
         "None of your shared servers record activity."
      );
      expect(
         render([server("Mine", true, Role.OWNER), server("Theirs", true)])
      ).toContain(
         "this server records what you do on it through S3 Viewer: Theirs."
      );
   });
});
