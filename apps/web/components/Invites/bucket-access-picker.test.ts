// @vitest-environment happy-dom
import { mountedRuntime } from "@/components/test-helpers";
import { act, createElement, useState } from "react";
import { Role, type S3Bucket } from "@s3-viewer/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BucketAccessPicker from "./bucket-access-picker";
import type { GrantRow } from "./bucket-grants";

const h = vi.hoisted(() => ({
   roles: new Map<string, { onChange: (role: Role) => void }>(),
}));

vi.mock("@s3-viewer/ui/components/checkbox", async () =>
   (await import("@/components/test-helpers")).checkboxButton()
);
vi.mock("./grant-scope", () => ({ default: () => null }));
vi.mock("./role-select", () => ({
   default: (props: { label: string; onChange: (role: Role) => void }) => {
      h.roles.set(props.label, props);
      return null;
   },
}));

const buckets: S3Bucket[] = ["site", "docs"].map((name) => ({
   name,
   creationDate: null,
   userRole: Role.OWNER,
   folders: null,
}));

let value: GrantRow[];
const Host = () => {
   const [rows, setRows] = useState<GrantRow[]>([]);
   value = rows;
   return createElement(BucketAccessPicker, {
      serverId: "server",
      myRole: Role.OWNER,
      buckets,
      isLoading: false,
      label: "Bucket access",
      value: rows,
      onChange: setRows,
   });
};

const view = mountedRuntime();
const checkbox = (name: string) => {
   const label = [...view.current.container.querySelectorAll("label")].find(
      (candidate) => candidate.textContent === name
   )!;
   return document.getElementById(label.htmlFor) as HTMLButtonElement;
};
const toggle = (name: string) => act(async () => checkbox(name).click());

beforeEach(async () => {
   h.roles.clear();
   await view.mount(createElement(Host));
});

describe("choosing buckets", () => {
   it("checks a bucket with the lowest role and unchecks it again", async () => {
      await toggle("site");
      expect(value).toEqual([
         { bucketName: "site", role: Role.VIEWER, folders: null },
      ]);
      expect(checkbox("site").getAttribute("aria-checked")).toBe("true");
      await toggle("site");
      expect(value).toEqual([]);
      expect(checkbox("site").getAttribute("aria-checked")).toBe("false");
   });

   it("keeps every chosen bucket when one row's role changes", async () => {
      await toggle("site");
      await toggle("docs");
      await act(async () => h.roles.get("Role on site")!.onChange(Role.EDITOR));
      expect(value).toEqual([
         { bucketName: "site", role: Role.EDITOR, folders: null },
         { bucketName: "docs", role: Role.VIEWER, folders: null },
      ]);
   });
});
