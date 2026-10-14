import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z, type ZodTypeAny } from "zod";
import { updateObjectSettingsBodySchema } from "@s3-viewer/types";
import { input, validate } from "./validate";

const schema = z.object({
   serverId: z.string().min(1),
   name: z.string().trim().min(1),
   count: z.coerce.number().int().optional(),
});
type Input = z.infer<typeof schema>;

type Parts = {
   method?: string;
   baseUrl?: string;
   path?: string;
   contentType?: string;
   params?: object;
   body?: unknown;
   query?: object;
};

const run = (parts: Parts, against: ZodTypeAny = schema) => {
   const req = {
      method: parts.method ?? "GET",
      baseUrl: parts.baseUrl ?? "",
      path: parts.path ?? "/",
      headers: { "content-type": parts.contentType },
      params: parts.params ?? {},
      body: parts.body,
      query: parts.query ?? {},
   };
   const res = { locals: {}, status: vi.fn(), json: vi.fn() };
   res.status.mockReturnValue(res);
   const next = vi.fn();
   validate(against)(
      req as unknown as Request,
      res as unknown as Response,
      next
   );
   return { res: res as unknown as Response, next };
};

const OBJECTS = "/servers/s1/buckets/b1/objects";

describe("validate", () => {
   it("reads query and params on a GET, with params winning", () => {
      const { res, next } = run({
         query: { count: "3", serverId: "from-query", name: " hi " },
         body: { name: "from-body" },
         params: { serverId: "from-params" },
      });
      expect(next).toHaveBeenCalledOnce();
      expect(input<Input>(res)).toEqual({
         serverId: "from-params",
         name: "hi",
         count: 3,
      });
   });

   it("reads body and params on a mutation, and never the query", () => {
      const { res, next } = run({
         method: "POST",
         query: { count: "3", name: "from-query" },
         body: { name: "from-body", serverId: "from-body" },
         params: { serverId: "from-params" },
      });
      expect(next).toHaveBeenCalledOnce();
      expect(input<Input>(res)).toEqual({
         serverId: "from-params",
         name: "from-body",
      });
   });

   it("keeps the query closed on a mutation that carried no json body", () => {
      const { res, next } = run({
         method: "POST",
         contentType: "text/plain",
         query: { name: "from-query" },
         params: { serverId: "a" },
      });
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
   });

   it("reads the query for the two uploads whose body is the file", () => {
      for (const [baseUrl, path, contentType] of [
         ["", `${OBJECTS}/v3/upload`, "text/csv"],
         [OBJECTS, "/v3/upload", "application/json"],
         [OBJECTS, "/v3/multipart-uploads/parts", "application/octet-stream"],
      ]) {
         const { res, next } = run({
            method: "PUT",
            baseUrl,
            path,
            contentType,
            query: { name: "from-query" },
            params: { serverId: "a" },
         });
         expect(next).toHaveBeenCalledOnce();
         expect(input<Input>(res).name).toBe("from-query");
      }
   });

   it("reads a part's query whatever its content type, so the route can refuse the type itself", () => {
      for (const contentType of ["application/json", "text/plain", undefined]) {
         const { res, next } = run({
            method: "PUT",
            baseUrl: OBJECTS,
            path: "/v3/multipart-uploads/parts",
            contentType,
            query: { name: "from-query" },
            body: { name: "from-body" },
            params: { serverId: "a" },
         });
         expect(next).toHaveBeenCalledOnce();
         expect(input<Input>(res).name).toBe("from-query");
      }
   });

   it("tolerates a missing body", () => {
      const { next } = run({
         method: "DELETE",
         params: { serverId: "a", name: "n" },
      });
      expect(next).toHaveBeenCalledOnce();
   });

   it("responds 400 with a VALIDATION code and a readable message", () => {
      const { res, next } = run({
         method: "POST",
         params: { serverId: "a" },
         body: { name: "" },
      });
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
         message: expect.stringMatching(/^name: /),
         code: "VALIDATION",
      });
   });

   describe("array caps", () => {
      const element = vi.fn((value: string) => value.length > 0);
      const capped = z.object({
         serverId: z.string(),
         keys: z.array(z.string().refine(element)).min(1).max(3),
         entries: z
            .array(
               z.object({
                  folders: z
                     .array(z.string())
                     .max(2, "Pick at most 2 folders")
                     .transform((folders) => folders)
                     .nullable(),
               })
            )
            .max(2)
            .refine(() => true)
            .optional(),
      });
      const post = (body: object) =>
         run({ method: "POST", params: { serverId: "a" }, body }, capped);

      it("refuses an over-cap array before parsing any element", () => {
         element.mockClear();
         const { res, next } = post({ keys: Array(250_000).fill("k") });
         expect(next).not.toHaveBeenCalled();
         expect(element).not.toHaveBeenCalled();
         expect(res.json).toHaveBeenCalledWith({
            message: "keys: Array must contain at most 3 element(s)",
            code: "VALIDATION",
         });
      });

      it("reaches capped arrays nested inside wrapped object elements, keeping custom messages", () => {
         const { res, next } = post({
            keys: ["k"],
            entries: [{ folders: null }, { folders: ["a/", "b/", "c/"] }],
         });
         expect(next).not.toHaveBeenCalled();
         expect(res.json).toHaveBeenCalledWith({
            message: "entries.1.folders: Pick at most 2 folders",
            code: "VALIDATION",
         });
      });

      it("lets arrays at the cap through to the full parse", () => {
         const { res, next } = post({
            keys: ["a", "b", "c"],
            entries: [{ folders: ["a/", "b/"] }],
         });
         expect(next).toHaveBeenCalledOnce();
         expect(input<z.infer<typeof capped>>(res).keys).toEqual([
            "a",
            "b",
            "c",
         ]);
      });

      it("refuses an over-count metadata map without walking its entries", () => {
         // numeric values would surface as the first entry's type error if the map were walked
         const metadata = Object.fromEntries(
            Array.from({ length: 100_000 }, (_, i) => [`k${i}`, i])
         );
         const { res, next } = run(
            {
               method: "PATCH",
               params: { serverId: "server123", bucketName: "photos" },
               body: {
                  expectedUserId: "user12345",
                  objectKey: "file.txt",
                  expectedETag: '"old"',
                  contentType: "text/plain",
                  metadata,
               },
            },
            updateObjectSettingsBodySchema
         );
         expect(next).not.toHaveBeenCalled();
         expect(res.json).toHaveBeenCalledWith({
            message: "metadata: Use at most 50 metadata entries",
            code: "VALIDATION",
         });
      });

      it("leaves non-array values to zod's own type errors", () => {
         const { res } = post({ keys: "not-an-array" });
         expect(res.json).toHaveBeenCalledWith({
            message: expect.stringMatching(/^keys: Expected array/),
            code: "VALIDATION",
         });
      });
   });

   it("throws when read on a route validate() never ran on", () => {
      expect(() => input({ locals: {} } as unknown as Response)).toThrow(
         "validate() has not run"
      );
   });
});
