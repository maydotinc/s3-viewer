import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { input, validate } from "./validate";

const schema = z.object({
   serverId: z.string().min(1),
   name: z.string().trim().min(1),
   count: z.coerce.number().int().optional(),
});

const run = (parts: { params?: object; body?: unknown; query?: object }) => {
   const req = {
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
   return { res, next };
};

describe("validate", () => {
   it("merges query, body and params with params winning", () => {
      const { res, next } = run({
         query: { count: "3", serverId: "from-query" },
         body: { name: " hi ", serverId: "from-body" },
         params: { serverId: "from-params" },
      });
      expect(next).toHaveBeenCalledOnce();
      expect(input<z.infer<typeof schema>>(res as unknown as Response)).toEqual(
         {
            serverId: "from-params",
            name: "hi",
            count: 3,
         }
      );
   });

   it("tolerates a missing body", () => {
      const { next } = run({ params: { serverId: "a" }, query: { name: "n" } });
      expect(next).toHaveBeenCalledOnce();
   });

   it("responds 400 with a VALIDATION code and a readable message", () => {
      const { res, next } = run({
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
});
