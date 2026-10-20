import * as React from "react";
import { serverInfo } from "@/components/test-helpers";
import { text, type Element } from "@/lib/test/elements";
import { Role, type S3Bucket, type ServerInfo } from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BucketUnavailable from "./unavailable";

const h = vi.hoisted(() => ({
   server: undefined as ServerInfo | undefined,
   bucket: undefined as S3Bucket | undefined,
}));

vi.mock("react", async (original) => ({
   ...(await original<typeof React>()),
   useState: () => [false, vi.fn()],
}));
vi.mock("next/router", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/stores/session-scope", () => ({ useServerId: () => "server" }));
vi.mock("@/lib/hooks/queries/server/useServerInfo", () => ({
   default: () => ({ data: h.server }),
}));
vi.mock("@/lib/hooks/queries/s3/useBuckets", () => ({
   default: () => ({ currentBucket: h.bucket }),
}));
vi.mock("./remove-bucket-dialog", () => ({ default: "remove-dialog" }));

const bucket = (userRole: Role): S3Bucket =>
   ({ name: "bucket", userRole }) as S3Bucket;

const offersRemove = () => {
   const state = BucketUnavailable({ bucketName: "bucket" }) as Element;
   const render = state.type as (props: unknown) => unknown;
   return text(render(state.props)).includes("Remove bucket");
};

describe("BucketUnavailable", () => {
   beforeEach(() => {
      h.server = serverInfo();
      h.bucket = bucket(Role.ADMIN);
   });

   it("offers removal for a listed bucket on a restricted server", () => {
      expect(offersRemove()).toBe(true);
   });

   it("hides removal when the server reaches every bucket", () => {
      h.server = serverInfo({ canRemoveBuckets: false });
      expect(offersRemove()).toBe(false);
   });

   it("hides removal for a bucket the server never listed", () => {
      h.bucket = undefined;
      expect(offersRemove()).toBe(false);
   });

   it("hides removal from a role without bucket delete", () => {
      h.bucket = bucket(Role.EDITOR);
      expect(offersRemove()).toBe(false);
   });
});
