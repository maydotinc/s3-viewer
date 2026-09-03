import { fail } from "@/lib/http";
import { ErrorCode } from "@s3-viewer/types";
import type { RequestHandler, Response } from "express";
import type { ZodIssue, ZodTypeAny } from "zod";

const asRecord = (value: unknown): Record<string, unknown> =>
   typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

const describe = (issue: ZodIssue | undefined): string => {
   if (!issue) return "Invalid request";
   const path = issue.path.join(".");
   return path ? `${path}: ${issue.message}` : issue.message;
};

const validate =
   (schema: ZodTypeAny): RequestHandler =>
   (req, res, next) => {
      const raw = {
         ...asRecord(req.query),
         ...asRecord(req.body),
         ...req.params,
      };
      const result = schema.safeParse(raw);
      if (!result.success) {
         fail(res, 400, describe(result.error.issues[0]), ErrorCode.VALIDATION);
         return;
      }
      res.locals.input = result.data;
      next();
   };

const input = <T>(res: Response): T => res.locals.input as T;

export { input, validate };
