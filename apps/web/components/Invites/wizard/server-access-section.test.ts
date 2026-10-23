// @vitest-environment happy-dom
import {
   buttonByText,
   mountedRuntime,
   serverInfo,
} from "@/components/test-helpers";
import { Role, type S3Bucket } from "@s3-viewer/types";
import { act, createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { GrantRow } from "../bucket-grants";
import ServerAccessSection from "./server-access-section";
import type { ServerBuckets } from "./useServerBuckets";

type PickerProps = {
   error: string | null;
   errorAction?: ReactNode;
   children?: ReactNode;
};

const h = vi.hoisted(() => ({ picker: undefined as PickerProps | undefined }));

vi.mock("../bucket-access-picker", () => ({
   default: (props: PickerProps) => {
      h.picker = props;
      return createElement("div", null, props.errorAction, props.children);
   },
}));
vi.mock("../role-select", () => ({ default: () => null }));

const server = serverInfo({ id: "one", name: "Owned storage" });
const bucket: S3Bucket = {
   name: "site",
   creationDate: null,
   userRole: Role.OWNER,
   folders: null,
};
const loaded = (buckets: S3Bucket[]): ServerBuckets => ({
   serverId: "one",
   buckets,
   isLoading: false,
   error: null,
   isFetching: false,
   refetch: () => {},
});
const row: GrantRow = { bucketName: "site", role: Role.VIEWER, folders: null };

const view = mountedRuntime();
const mount = async (
   props: Partial<Parameters<typeof ServerAccessSection>[0]> = {}
) => {
   await view.mount(
      createElement(ServerAccessSection, {
         server,
         access: undefined,
         buckets: loaded([bucket]),
         expanded: true,
         single: false,
         submitted: false,
         focusRequest: 0,
         onAccessChange: () => {},
         onExpand: () => {},
         onRemove: () => {},
         ...props,
      })
   );
   return view.current.container;
};

describe("a server's access section", () => {
   it("reads as not set up until a bucket is checked", async () => {
      const container = await mount();
      expect(container.textContent).toContain("Not set up yet");
      await mount({ access: { role: Role.VIEWER, rows: [row] } });
      expect(view.current.container.textContent).toContain(
         "Viewer · all buckets"
      );
   });

   it("names the problem in the header once the user tried to continue", async () => {
      const container = await mount({ submitted: true });
      expect(container.textContent).toContain("Choose at least one bucket");
      expect(h.picker?.error).toBe("Choose at least one bucket");
   });

   it("keeps a row-level problem out of the list line, since the row shows it", async () => {
      await mount({
         submitted: true,
         access: { role: Role.VIEWER, rows: [{ ...row, folders: [] }] },
      });
      expect(view.current.container.textContent).toContain(
         "Check the access on site."
      );
      expect(h.picker?.error).toBeNull();
   });

   it("lets the user drop a server without buckets, unless it is the only one", async () => {
      const onRemove = vi.fn();
      const container = await mount({ buckets: loaded([]), onRemove });
      expect(container.textContent).toContain("No buckets to share");
      await act(async () =>
         buttonByText(container, "Remove this server")!.click()
      );
      expect(onRemove).toHaveBeenCalledWith("one");
      await mount({ buckets: loaded([]), single: true });
      expect(
         buttonByText(view.current.container, "Remove this server")
      ).toBeUndefined();
   });

   it("collapses into a header button that reports its state", async () => {
      const onExpand = vi.fn();
      h.picker = undefined;
      const container = await mount({ expanded: false, onExpand });
      const header = container.querySelector<HTMLButtonElement>(
         "button[aria-expanded]"
      )!;
      expect(header.getAttribute("aria-expanded")).toBe("false");
      expect(h.picker).toBeUndefined();
      await act(async () => header.click());
      expect(onExpand).toHaveBeenCalledWith("one");
   });
});
