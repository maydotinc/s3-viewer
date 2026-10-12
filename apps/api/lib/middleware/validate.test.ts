import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
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

const run = (parts: Parts) => {
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
   validate(schema)(
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

   it("throws when read on a route validate() never ran on", () => {
      expect(() => input({ locals: {} } as unknown as Response)).toThrow(
         "validate() has not run"
      );
   });
});
