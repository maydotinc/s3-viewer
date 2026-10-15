// @vitest-environment happy-dom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   mountedRuntime,
   serverInfo,
   submitForm,
   typeInto,
} from "@/components/test-helpers";
import { deferred, flushRuntime } from "@/lib/test/runtime";
import UpdateCredentialsModal from "../UpdateCredentialsModal";
import ConnectModal from "./index";

const h = vi.hoisted(() => ({
   encrypt: vi.fn(),
   establish: vi.fn(),
   create: vi.fn(),
   update: vi.fn(),
   post: vi.fn(),
   allowHttp: false,
}));
vi.mock("@/lib/auth", () => ({
   authClient: {
      useSession: () => ({ data: { user: { emailVerified: true } } }),
   },
}));
vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "user12345" }));
vi.mock("@/lib/hooks/queries/useInstanceConfig", () => ({
   default: () => ({
      data: { encryptionPublicKey: "key", allowInsecureEndpoints: h.allowHttp },
   }),
   encryptionState: () => "ready",
   ENCRYPTION_ERROR: "Encryption failed",
}));
vi.mock("@/lib/utils/encryption", () => ({ encryptCredentials: h.encrypt }));
vi.mock("@/lib/hooks/mutations/server/useCreateServer", () => ({
   default: () => ({ isPending: false, mutateAsync: h.create }),
}));
vi.mock("@/lib/hooks/mutations/server/useEstablishConnection", () => ({
   default: () => ({ isPending: false, mutateAsync: h.establish }),
}));
vi.mock("@/lib/hooks/mutations/server/useUpdateCredentials", () => ({
   default: () => ({ isPending: false, mutate: h.update }),
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { post: h.post },
}));
vi.mock("@s3-viewer/ui/components/dialog", async () =>
   (await import("@/components/test-helpers")).passthroughDialog()
);

const view = mountedRuntime();
let prefix = "connect";
const input = (id: string) =>
   view.current.container.querySelector<HTMLInputElement>(`#${id}`)!;
const type = (id: string, value: string) =>
   act(async () => typeInto(input(id), value));
const change = (key: string, value: string) => type(`${prefix}-${key}`, value);
const submit = async () => {
   await act(async () => submitForm(view.current.container));
   await flushRuntime();
   await flushRuntime();
};
const open = async (kind: "connect" | "update") => {
   prefix = kind === "connect" ? "connect" : "update-credentials";
   await view.mount(
      kind === "connect"
         ? createElement(ConnectModal, { onClose: vi.fn() })
         : createElement(UpdateCredentialsModal, {
              onClose: vi.fn(),
              server: serverInfo({ id: "server123" }),
           })
   );
   if (kind === "connect") await type("connect-name", "Storage");
   await change("endpoint", "https://s3.example.com");
   await change("access-key", "access");
   await change("secret-key", " secret key ");
};

beforeEach(() => {
   vi.clearAllMocks();
   h.allowHttp = false;
   h.encrypt.mockResolvedValue("encrypted");
   h.establish.mockResolvedValue({
      provider: "Other",
      listBucketsAllowed: false,
      bucketCount: 0,
   });
   h.create.mockResolvedValue(undefined);
   h.post.mockImplementation(
      async (_path, body: { bucketNames: string[] }) => ({
         results: body.bucketNames.map((bucketName) => ({
            bucketName,
            accessible: true,
         })),
      })
   );
});

describe.each(["connect", "update"] as const)(
   "%s credential boundary",
   (kind) => {
      it("rejects an invalid region before encryption or submission", async () => {
         await open(kind);
         await change("region", "US-EAST-1");
         await submit();
         expect(h.encrypt).not.toHaveBeenCalled();
         expect(h.establish).not.toHaveBeenCalled();
         expect(h.update).not.toHaveBeenCalled();
         expect(view.text()).toContain("Invalid region");
      });

      it("enforces effective HTTP policy and preserves secret material", async () => {
         await open(kind);
         await change("endpoint", "http://minio.local:9000/gateway/");
         await submit();
         expect(h.encrypt).not.toHaveBeenCalled();
         expect(view.text()).toContain("https://");
         h.allowHttp = true;
         await change("region", "us-east-1");
         await submit();
         expect(h.encrypt).toHaveBeenCalledWith(
            {
               endpoint: "http://minio.local:9000/gateway/",
               region: "us-east-1",
               accessKey: "access",
               secretKey: " secret key ",
            },
            "key",
            "user12345"
         );
         expect(
            kind === "connect" ? h.establish : h.update
         ).toHaveBeenCalledOnce();
      });
   }
);

describe("named bucket connection", () => {
   const detected = async (count: number) => {
      await open("connect");
      await submit();
      await type(
         "bucket-names",
         Array.from({ length: count }, (_, index) => `bucket-${index}`).join(
            ", "
         )
      );
   };

   it.each([21, 100])(
      "validates %i names in bounded requests before connecting",
      async (count) => {
         await detected(count);
         await submit();
         expect(h.post).toHaveBeenCalledTimes(Math.ceil(count / 20));
         expect(
            h.post.mock.calls.every((call) => call[1].bucketNames.length <= 20)
         ).toBe(true);
         expect(h.create.mock.calls[0]?.[0].bucketNames).toHaveLength(count);
      }
   );

   it("rejects 101 names without a validation request", async () => {
      await detected(101);
      await submit();
      expect(h.post).not.toHaveBeenCalled();
      expect(h.create).not.toHaveBeenCalled();
      expect(view.text()).toContain("at most 100");
   });

   it("waits for every result and blocks creation on inaccessible or missing buckets", async () => {
      await detected(21);
      h.post.mockImplementation(
         async (_path, body: { bucketNames: string[] }) => ({
            results: body.bucketNames.map((bucketName) => ({
               bucketName,
               accessible: bucketName !== "bucket-20",
            })),
         })
      );
      await submit();
      expect(h.post).toHaveBeenCalledTimes(2);
      expect(h.create).not.toHaveBeenCalled();
      expect(view.text()).toContain("can't access");
   });
});

describe("connection confirmation snapshot", () => {
   it("locks edits and duplicate submission throughout encryption and detection", async () => {
      const encryption = deferred<string>();
      const detection = deferred<{
         provider: string;
         listBucketsAllowed: boolean;
         bucketCount: number;
      }>();
      h.encrypt.mockReturnValue(encryption.promise);
      h.establish.mockReturnValue(detection.promise);
      await open("connect");
      await submit();
      expect(input("connect-name").disabled).toBe(true);
      expect(input("connect-endpoint").disabled).toBe(true);
      await type("connect-name", "Different name");
      await change("endpoint", "https://different.example.com");
      await submit();
      expect(h.encrypt).toHaveBeenCalledOnce();
      await act(async () => encryption.resolve("first-credentials"));
      await change("endpoint", "https://also-different.example.com");
      await act(async () =>
         detection.resolve({
            provider: "Other",
            listBucketsAllowed: true,
            bucketCount: 1,
         })
      );
      await flushRuntime();
      expect(view.text()).toContain("Storage");
      expect(view.text()).toContain("https://s3.example.com");
      expect(view.text()).not.toContain("different");
      await submit();
      expect(h.create).toHaveBeenCalledExactlyOnceWith({
         encryptedCredentials: "first-credentials",
         serverName: "Storage",
         bucketNames: undefined,
      });
   });

   it("locks the reviewed bucket scope until validation and creation finish", async () => {
      await open("connect");
      await submit();
      await type("bucket-names", "original-bucket");
      const checked = deferred<{
         results: { bucketName: string; accessible: boolean }[];
      }>();
      const created = deferred<void>();
      h.post.mockReturnValue(checked.promise);
      h.create.mockReturnValue(created.promise);
      await submit();
      expect(input("bucket-names").disabled).toBe(true);
      await type("bucket-names", "different-bucket");
      await submit();
      expect(h.post).toHaveBeenCalledOnce();
      expect(h.create).not.toHaveBeenCalled();
      await act(async () =>
         checked.resolve({
            results: [{ bucketName: "original-bucket", accessible: true }],
         })
      );
      await flushRuntime();
      expect(input("bucket-names").value).toBe("original-bucket");
      expect(input("bucket-names").disabled).toBe(true);
      await act(async () => created.resolve());
      await flushRuntime();
      expect(h.create).toHaveBeenCalledExactlyOnceWith({
         encryptedCredentials: "encrypted",
         serverName: "Storage",
         bucketNames: ["original-bucket"],
      });
   });

   it("does not continue a dismissed connection after encryption finishes", async () => {
      const encryption = deferred<string>();
      h.encrypt.mockReturnValue(encryption.promise);
      await open("connect");
      await submit();
      await view.current.unmount();
      await act(async () => encryption.resolve("encrypted"));
      await flushRuntime();
      expect(h.establish).not.toHaveBeenCalled();
   });

   it("does not create a server after the modal unmounts during bucket validation", async () => {
      await open("connect");
      await submit();
      await type("bucket-names", "original-bucket");
      const checked = deferred<{
         results: { bucketName: string; accessible: boolean }[];
      }>();
      h.post.mockReturnValue(checked.promise);
      await submit();
      await view.current.unmount();
      await act(async () =>
         checked.resolve({
            results: [{ bucketName: "original-bucket", accessible: true }],
         })
      );
      await flushRuntime();
      expect(h.create).not.toHaveBeenCalled();
   });
});
