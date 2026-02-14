import { z } from "zod";
import { Request, Response, NextFunction } from "express";

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
   return (req: Request, res: Response, next: NextFunction) => {
      const result = schema.safeParse(req.body);
      if (!result.success) {
         res.status(400).json({ error: "Invalid request parameters" });
         return;
      }
      req.body = result.data;
      next();
   };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
   return (req: Request, res: Response, next: NextFunction) => {
      const result = schema.safeParse(req.query);
      if (!result.success) {
         res.status(400).json({ error: "Invalid request parameters" });
         return;
      }
      next();
   };
}
