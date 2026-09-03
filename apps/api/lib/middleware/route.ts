import { asyncHandler } from "@/lib/http";
import { authorize, authorizeMemberAction } from "@/lib/middleware/authorize";
import { validate } from "@/lib/middleware/validate";
import type { Permission } from "@s3-viewer/permissions";
import type { Request, RequestHandler, Response } from "express";
import type { ZodTypeAny } from "zod";

type Handler = (req: Request, res: Response) => Promise<unknown>;
type Scope = "server" | "bucket";

const validatedRoute = (
   schema: ZodTypeAny,
   handler: Handler
): RequestHandler[] => [validate(schema), asyncHandler(handler)];

const guarded =
   (scope: Scope) =>
   (
      permission: Permission,
      schema: ZodTypeAny,
      handler: Handler
   ): RequestHandler[] => [
      validate(schema),
      authorize(permission, { scope }),
      asyncHandler(handler),
   ];

const serverRoute = guarded("server");
const bucketRoute = guarded("bucket");

const memberRoute = (
   schema: ZodTypeAny,
   handler: Handler
): RequestHandler[] => [
   validate(schema),
   authorizeMemberAction(),
   asyncHandler(handler),
];

export { bucketRoute, memberRoute, serverRoute, validatedRoute };
