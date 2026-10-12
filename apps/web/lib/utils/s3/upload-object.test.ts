import {
   MULTIPART_CONCURRENCY,
   MULTIPART_THRESHOLD_BYTES,
} from "@s3-viewer/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadCancelled } from "./upload-cancelled";

const identity = vi.hoisted(() => ({ userId: "user-a" as string | null }));
vi.mock("@/lib/stores/session-store", () => ({
   default: { getState: () => identity, subscribe: () => () => {} },
}));

const multipart = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("./upload-multipart", () => ({ uploadMultipart: multipart.upload }));

type ProgressHandler = (event: {
   loaded: number;
   lengthComputable: boolean;
}) => void;

class FakeXHR {
   static readonly DONE = 4;
   static instances: FakeXHR[] = [];

   readyState = 0;
   status = 0;
   responseText = "";
   timeout = 0;
   withCredentials = false;
   upload: { onprogress: ProgressHandler | null } = { onprogress: null };
   onload: (() => void) | null = null;
   onerror: (() => void) | null = null;
   onabort: (() => void) | null = null;
   ontimeout: (() => void) | null = null;
   method = "";
   url = "";
   headers: Record<string, string> = {};
   responseHeaders: Record<string, string> = {};

   constructor() {
      FakeXHR.instances.push(this);
   }

   open(method: string, url: string) {
      this.method = method;
      this.url = url;
   }

   setRequestHeader(key: string, value: string) {
      this.headers[key] = value;
   }

   send() {
      this.readyState = 1;
   }

   getResponseHeader(name: string) {
      return this.responseHeaders[name] ?? null;
   }

   abort() {
      this.readyState = FakeXHR.DONE;
      this.onabort?.();
   }

   progress(loaded: number) {
      this.upload.onprogress?.({ loaded, lengthComputable: true });
   }

   respond(
      status: number,
      body: unknown,
      responseHeaders: Record<string, string> = {}
   ) {
      this.status = status;
      this.responseHeaders = responseHeaders;
      this.responseText = JSON.stringify(body);
      this.readyState = FakeXHR.DONE;
      this.onload?.();
   }

   fail() {
      this.readyState = FakeXHR.DONE;
      this.onerror?.();
   }

   timeoutOut() {
      this.readyState = FakeXHR.DONE;
      this.ontimeout?.();
   }
}

vi.stubGlobal("XMLHttpRequest", FakeXHR);

const { uploadObject } = await import("./upload-object");
const { setUnauthorizedHandler } = await import("@/lib/api");

const body = { key: "k", size: 10, eTag: "e" };
const makeFile = (size = 10) => new File(["x".repeat(size)], "a.txt");

const upload = (overrides: { file?: File; expectedETag?: string } = {}) =>
   uploadObject({
      userId: "user-a",
      serverId: "s",
      bucketName: "b",
      objectKey: "k",
      file: overrides.file ?? makeFile(),
      contentType: "text/plain",
      expectedETag: overrides.expectedETag,
      onProgress: vi.fn(),
   });

beforeEach(() => {
   identity.userId = "user-a";
   FakeXHR.instances = [];
   multipart.upload.mockReset().mockReturnValue({
      done: Promise.resolve(body),
      abort: vi.fn(),
   });
   vi.useFakeTimers();
});

afterEach(() => {
   setUnauthorizedHandler(() => {});
   vi.useRealTimers();
});

describe("uploadObject", () => {
   it("reports a same-user upload 401 but ignores a delayed 401 after the account changes", async () => {
      const unauthorized = vi.fn();
      setUnauthorizedHandler(unauthorized);
      const first = upload();
      FakeXHR.instances[0]?.respond(401, { message: "Sign in required" });
      await expect(first.done).rejects.toMatchObject({ status: 401 });
      expect(unauthorized).toHaveBeenCalledOnce();
      const previous = upload();
      identity.userId = "user-b";
      FakeXHR.instances[1]?.respond(401, { message: "Sign in required" });
      await expect(previous.done).rejects.toMatchObject({ status: 401 });
      expect(unauthorized).toHaveBeenCalledOnce();
   });

   it("sends the captured user identity to the API on every retry", async () => {
      const handle = upload();
      const firstUrl = FakeXHR.instances[0]?.url ?? "";
      expect(
         new URL(firstUrl, "http://localhost").searchParams.get(
            "expectedUserId"
         )
      ).toBe("user-a");
      FakeXHR.instances[0]?.fail();
      await vi.advanceTimersByTimeAsync(500);
      expect(FakeXHR.instances[1]?.url).toBe(firstUrl);
      FakeXHR.instances[1]?.respond(201, body);
      await expect(handle.done).resolves.toEqual(body);
   });

   it.each([null, "user-b"])(
      "refuses an upload under changed identity %s before sending bytes",
      async (userId) => {
         identity.userId = userId;
         const handle = upload();
         await expect(handle.done).rejects.toBeInstanceOf(UploadCancelled);
         expect(FakeXHR.instances).toHaveLength(0);
      }
   );

   it.each([null, "user-b"])(
      "cancels a network retry when identity becomes %s",
      async (userId) => {
         const handle = upload();
         const result = expect(handle.done).rejects.toBeInstanceOf(
            UploadCancelled
         );
         FakeXHR.instances[0]?.fail();
         identity.userId = userId;
         await vi.advanceTimersByTimeAsync(500);
         await result;
         expect(FakeXHR.instances).toHaveLength(1);
      }
   );

   it.each(["fail", "timeoutOut"] as const)(
      "never replays an overwrite after an ambiguous %s response",
      async (failure) => {
         const handle = upload({ expectedETag: '"before-confirmation"' });
         const rejected = expect(handle.done).rejects.toMatchObject({
            status: 0,
            code: "UPLOAD_OUTCOME_UNKNOWN",
            message: expect.stringContaining("Refresh the folder"),
         });
         const firstUrl = FakeXHR.instances[0]?.url ?? "";
         expect(new URL(firstUrl, "http://localhost").pathname).toBe(
            "/servers/s/buckets/b/objects/v3/upload"
         );
         expect(
            new URL(firstUrl, "http://localhost").searchParams.get(
               "expectedETag"
            )
         ).toBe('"before-confirmation"');
         FakeXHR.instances[0]?.[failure]();
         await rejected;
         await vi.advanceTimersByTimeAsync(5000);
         expect(FakeXHR.instances).toHaveLength(1);
      }
   );

   it("does not send replacement authority for a new file", async () => {
      const handle = upload();
      expect(
         new URL(
            FakeXHR.instances[0]?.url ?? "",
            "http://localhost"
         ).searchParams.has("expectedETag")
      ).toBe(false);
      FakeXHR.instances[0]?.respond(201, body);
      await expect(handle.done).resolves.toEqual(body);
   });

   it("resolves with the parsed body and reports progress up to the full size", async () => {
      const onProgress = vi.fn();
      const handle = uploadObject({
         userId: "user-a",
         serverId: "s",
         bucketName: "b",
         objectKey: "k",
         file: makeFile(),
         contentType: "text/plain",
         onProgress,
      });
      const xhr = FakeXHR.instances[0];
      if (!xhr) throw new Error("no xhr");
      xhr.progress(5);
      xhr.respond(201, body);
      await expect(handle.done).resolves.toEqual(body);
      expect(onProgress).toHaveBeenCalledWith(5);
      expect(onProgress).toHaveBeenCalledWith(10);
   });

   it("sets a positive client-side timeout before sending", async () => {
      const handle = upload({ file: makeFile(10) });
      expect(FakeXHR.instances[0]?.timeout).toBeGreaterThan(0);
      handle.abort();
      await expect(handle.done).rejects.toBeInstanceOf(UploadCancelled);
   });

   it("retries a new-file status-0 network error with exponential backoff, up to two retries", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.fail();
      await vi.advanceTimersByTimeAsync(500);
      expect(FakeXHR.instances).toHaveLength(2);

      FakeXHR.instances[1]?.fail();
      await vi.advanceTimersByTimeAsync(999);
      expect(FakeXHR.instances).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(FakeXHR.instances).toHaveLength(3);

      FakeXHR.instances[2]?.respond(200, body);
      await expect(handle.done).resolves.toEqual(body);
   });

   it("stops retrying once the retry bound is exhausted", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.fail();
      await vi.advanceTimersByTimeAsync(500);
      FakeXHR.instances[1]?.fail();
      await vi.advanceTimersByTimeAsync(1000);
      FakeXHR.instances[2]?.fail();

      await expect(handle.done).rejects.toMatchObject({
         status: 0,
         code: "UPLOAD_OUTCOME_UNKNOWN",
      });
      expect(FakeXHR.instances).toHaveLength(3);
   });

   it("treats a new-file client-side timeout as a retryable network error", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.timeoutOut();
      await vi.advanceTimersByTimeAsync(500);
      expect(FakeXHR.instances).toHaveLength(2);
      FakeXHR.instances[1]?.respond(200, body);
      await expect(handle.done).resolves.toEqual(body);
   });

   it("rejects instead of hanging when a 2xx body can't be parsed", async () => {
      const handle = upload();
      const xhr = FakeXHR.instances[0];
      if (!xhr) throw new Error("no xhr");
      xhr.status = 200;
      xhr.responseText = "<!doctype html>";
      xhr.readyState = FakeXHR.DONE;
      xhr.onload?.();
      await expect(handle.done).rejects.toMatchObject({ status: 200 });
      expect(FakeXHR.instances).toHaveLength(1);
   });

   it("never retries a 4xx or 5xx response", async () => {
      const serverError = upload();
      FakeXHR.instances[0]?.respond(500, { message: "boom" });
      await expect(serverError.done).rejects.toMatchObject({ status: 500 });
      expect(FakeXHR.instances).toHaveLength(1);

      const clientError = upload();
      FakeXHR.instances[1]?.respond(404, { message: "missing" });
      await expect(clientError.done).rejects.toMatchObject({ status: 404 });
      expect(FakeXHR.instances).toHaveLength(2);
   });

   it("aborting mid-flight rejects with UploadCancelled and aborts the request", async () => {
      const handle = upload();
      const xhr = FakeXHR.instances[0];
      if (!xhr) throw new Error("no xhr");
      const abortSpy = vi.spyOn(xhr, "abort");
      handle.abort();
      await expect(handle.done).rejects.toBeInstanceOf(UploadCancelled);
      expect(abortSpy).toHaveBeenCalledOnce();
   });

   it("aborting during backoff cancels immediately instead of waiting out the delay", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.fail();
      handle.abort();
      await expect(handle.done).rejects.toBeInstanceOf(UploadCancelled);
      expect(FakeXHR.instances).toHaveLength(1);
   });
});

describe("waiting out a busy server", () => {
   const busy = { message: "Upload capacity is busy", code: "RATE_LIMITED" };

   it.each([undefined, '"before-confirmation"'])(
      "retries a 429 with growing backoff for expected ETag %s",
      async (expectedETag) => {
         const onProgress = vi.fn();
         const handle = uploadObject({
            userId: "user-a",
            serverId: "s",
            bucketName: "b",
            objectKey: "k",
            file: makeFile(),
            contentType: "text/plain",
            expectedETag,
            onProgress,
         });
         FakeXHR.instances[0]?.respond(429, busy);
         await vi.advanceTimersByTimeAsync(999);
         expect(FakeXHR.instances).toHaveLength(1);
         await vi.advanceTimersByTimeAsync(1);
         expect(FakeXHR.instances).toHaveLength(2);
         expect(FakeXHR.instances[1]?.url).toBe(FakeXHR.instances[0]?.url);
         expect(onProgress).toHaveBeenLastCalledWith(0);

         FakeXHR.instances[1]?.respond(429, busy);
         await vi.advanceTimersByTimeAsync(1999);
         expect(FakeXHR.instances).toHaveLength(2);
         await vi.advanceTimersByTimeAsync(1);
         expect(FakeXHR.instances).toHaveLength(3);

         FakeXHR.instances[2]?.respond(201, body);
         await expect(handle.done).resolves.toEqual(body);
      }
   );

   it("waits as long as Retry-After asks, up to a minute", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.respond(429, busy, { "Retry-After": "5" });
      await vi.advanceTimersByTimeAsync(4999);
      expect(FakeXHR.instances).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(FakeXHR.instances).toHaveLength(2);

      FakeXHR.instances[1]?.respond(429, busy, { "Retry-After": "3600" });
      await vi.advanceTimersByTimeAsync(59_999);
      expect(FakeXHR.instances).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(FakeXHR.instances).toHaveLength(3);

      FakeXHR.instances[2]?.respond(201, body);
      await expect(handle.done).resolves.toEqual(body);
   });

   it("gives up with the server's refusal once the 429 bound is spent", async () => {
      const handle = upload();
      const rejected = expect(handle.done).rejects.toMatchObject({
         status: 429,
         message: "Upload capacity is busy",
      });
      for (let attempt = 0; attempt < 9; attempt++) {
         expect(FakeXHR.instances).toHaveLength(attempt + 1);
         FakeXHR.instances[attempt]?.respond(429, busy);
         await vi.advanceTimersByTimeAsync(15_000);
      }
      await rejected;
      expect(FakeXHR.instances).toHaveLength(9);
   });

   it("does not spend the network retries on a busy server", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.respond(429, busy);
      await vi.advanceTimersByTimeAsync(1000);
      FakeXHR.instances[1]?.fail();
      await vi.advanceTimersByTimeAsync(500);
      FakeXHR.instances[2]?.fail();
      await vi.advanceTimersByTimeAsync(1000);
      expect(FakeXHR.instances).toHaveLength(4);
      FakeXHR.instances[3]?.respond(201, body);
      await expect(handle.done).resolves.toEqual(body);
   });

   it("cancels at once while waiting out a 429", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.respond(429, busy);
      await vi.advanceTimersByTimeAsync(10);
      handle.abort();
      await expect(handle.done).rejects.toBeInstanceOf(UploadCancelled);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(FakeXHR.instances).toHaveLength(1);
   });
});

describe("a conflict after an ambiguous attempt", () => {
   const conflict = { message: "The file changed or already exists." };

   it("reports an unknown outcome when a retried new-file upload finds the file", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.fail();
      await vi.advanceTimersByTimeAsync(500);
      FakeXHR.instances[1]?.respond(409, conflict);
      await expect(handle.done).rejects.toMatchObject({
         status: 0,
         code: "UPLOAD_OUTCOME_UNKNOWN",
         message: expect.stringContaining("Refresh the folder"),
      });
      expect(FakeXHR.instances).toHaveLength(2);
   });

   it("still reports a conflict on the first attempt as a conflict", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.respond(409, conflict);
      await expect(handle.done).rejects.toMatchObject({
         status: 409,
         message: "The file changed or already exists.",
      });
   });

   it("still reports a conflict after only a 429 as a conflict", async () => {
      const handle = upload();
      FakeXHR.instances[0]?.respond(429, { message: "busy" });
      await vi.advanceTimersByTimeAsync(1000);
      FakeXHR.instances[1]?.respond(409, conflict);
      await expect(handle.done).rejects.toMatchObject({ status: 409 });
   });
});

describe("sharing upload slots across the tab", () => {
   it("never has more single uploads in flight than the shared bound", async () => {
      const handles = Array.from({ length: MULTIPART_CONCURRENCY + 2 }, () =>
         upload()
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(FakeXHR.instances).toHaveLength(MULTIPART_CONCURRENCY);
      FakeXHR.instances[0]?.respond(201, body);
      await vi.advanceTimersByTimeAsync(0);
      expect(FakeXHR.instances).toHaveLength(MULTIPART_CONCURRENCY + 1);
      for (let index = 1; index < handles.length; index++) {
         FakeXHR.instances[index]?.respond(201, body);
         await vi.advanceTimersByTimeAsync(0);
      }
      await expect(
         Promise.all(handles.map((handle) => handle.done))
      ).resolves.toHaveLength(MULTIPART_CONCURRENCY + 2);
   });

   it("hands its slot on while it waits out a 429", async () => {
      const handles = Array.from({ length: MULTIPART_CONCURRENCY + 1 }, () =>
         upload()
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(FakeXHR.instances).toHaveLength(MULTIPART_CONCURRENCY);
      FakeXHR.instances[0]?.respond(429, { message: "busy" });
      await vi.advanceTimersByTimeAsync(0);
      expect(FakeXHR.instances).toHaveLength(MULTIPART_CONCURRENCY + 1);
      for (const handle of handles) handle.abort();
      await Promise.allSettled(handles.map((handle) => handle.done));
   });

   it("cancels a queued upload at once without ever sending it", async () => {
      const handles = Array.from({ length: MULTIPART_CONCURRENCY + 1 }, () =>
         upload()
      );
      const queued = handles.at(-1)!;
      await vi.advanceTimersByTimeAsync(0);
      queued.abort();
      await expect(queued.done).rejects.toBeInstanceOf(UploadCancelled);
      for (let index = 0; index < MULTIPART_CONCURRENCY; index++)
         FakeXHR.instances[index]?.respond(201, body);
      await Promise.all(handles.slice(0, -1).map((handle) => handle.done));
      await vi.advanceTimersByTimeAsync(0);
      expect(FakeXHR.instances).toHaveLength(MULTIPART_CONCURRENCY);
   });
});

describe("choosing between one request and parts", () => {
   const sized = (size: number) => {
      const file = makeFile(1);
      Object.defineProperty(file, "size", { value: size });
      return file;
   };

   it.each([1, MULTIPART_THRESHOLD_BYTES])(
      "sends %i bytes as a single request",
      async (size) => {
         const handle = upload({ file: sized(size) });
         expect(multipart.upload).not.toHaveBeenCalled();
         expect(
            new URL(FakeXHR.instances[0]?.url ?? "", "http://localhost")
               .pathname
         ).toBe("/servers/s/buckets/b/objects/v3/upload");
         FakeXHR.instances[0]?.respond(201, body);
         await expect(handle.done).resolves.toEqual(body);
      }
   );

   it("switches to parts one byte over the threshold", async () => {
      const file = sized(MULTIPART_THRESHOLD_BYTES + 1);
      const handle = upload({ file });
      expect(FakeXHR.instances).toHaveLength(0);
      expect(multipart.upload).toHaveBeenCalledWith(
         expect.objectContaining({ file, userId: "user-a", objectKey: "k" })
      );
      await expect(handle.done).resolves.toEqual(body);
   });

   it("hands a replacement's ETag to the multipart path too", () => {
      upload({
         file: sized(MULTIPART_THRESHOLD_BYTES + 1),
         expectedETag: '"before-confirmation"',
      });
      expect(multipart.upload).toHaveBeenCalledWith(
         expect.objectContaining({ expectedETag: '"before-confirmation"' })
      );
   });
});
