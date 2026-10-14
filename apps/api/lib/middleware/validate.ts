import { fail } from "@/lib/http";
import { readsQueryFields } from "./upload-body";
import { ErrorCode } from "@s3-viewer/types";
import type { Request, RequestHandler, Response } from "express";
import {
   ZodArray,
   ZodDefault,
   ZodEffects,
   ZodIssueCode,
   ZodNullable,
   ZodObject,
   ZodOptional,
   ZodPipeline,
   getErrorMap,
   type ZodIssue,
   type ZodTypeAny,
} from "zod";

const asRecord = (value: unknown): Record<string, unknown> =>
   typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

const describe = (issue: ZodIssue | undefined): string => {
   if (!issue) return "Invalid request";
   const path = issue.path.join(".");
   return path ? `${path}: ${issue.message}` : issue.message;
};

// wrappers that still see the raw value; preprocess is excluded because its inner schema sees the output.
const rawShape = (schema: ZodTypeAny): ZodTypeAny => {
   if (schema instanceof ZodEffects && schema._def.effect.type !== "preprocess")
      return rawShape(schema.innerType());
   if (schema instanceof ZodOptional || schema instanceof ZodNullable)
      return rawShape(schema.unwrap());
   if (schema instanceof ZodDefault) return rawShape(schema.removeDefault());
   if (schema instanceof ZodPipeline) return rawShape(schema._def.in);
   return schema;
};

const tooLong = (
   max: { value: number; message?: string },
   value: unknown[],
   path: (string | number)[]
): ZodIssue => {
   const issue = {
      code: ZodIssueCode.too_big,
      maximum: max.value,
      type: "array",
      inclusive: true,
      exact: false,
      path,
   } as const;
   const message =
      max.message ??
      getErrorMap()(issue, { data: value, defaultError: "" }).message;
   return { ...issue, message };
};

// zod 3 parses every element of an over-long array before reporting max(), so a 1 MB array of
// tiny keys costs real CPU; capped arrays are measured first and refused without that walk.
const overCap = (
   schema: ZodTypeAny,
   value: unknown,
   path: (string | number)[] = []
): ZodIssue | undefined => {
   const shape = rawShape(schema);
   if (shape instanceof ZodArray && Array.isArray(value)) {
      const max = shape._def.maxLength;
      if (max && value.length > max.value) return tooLong(max, value, path);
      const element = rawShape(shape.element);
      if (!(element instanceof ZodArray || element instanceof ZodObject))
         return undefined;
      for (const [index, item] of value.entries()) {
         const found = overCap(element, item, [...path, index]);
         if (found) return found;
      }
      return undefined;
   }
   if (!(shape instanceof ZodObject)) return undefined;
   const record = asRecord(value);
   for (const [key, field] of Object.entries<ZodTypeAny>(shape.shape)) {
      const found = overCap(field, record[key], [...path, key]);
      if (found) return found;
   }
   return undefined;
};

const fieldsOf = (req: Request): unknown =>
   req.method === "GET" || req.method === "HEAD" || readsQueryFields(req)
      ? req.query
      : req.body;

const validate =
   (schema: ZodTypeAny): RequestHandler =>
   (req, res, next) => {
      const raw = { ...asRecord(fieldsOf(req)), ...req.params };
      const capped = overCap(schema, raw);
      if (capped) {
         fail(res, 400, describe(capped), ErrorCode.VALIDATION);
         return;
      }
      const result = schema.safeParse(raw);
      if (!result.success) {
         fail(res, 400, describe(result.error.issues[0]), ErrorCode.VALIDATION);
         return;
      }
      res.locals.input = result.data;
      next();
   };

const input = <T>(res: Response): T => {
   if (res.locals.input === undefined) {
      throw new Error("validate() has not run on this route");
   }
   return res.locals.input as T;
};

export { input, validate };
