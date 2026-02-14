import { prisma } from "@s3-viewer/db";
import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

const userRouter: Router = Router();

const userCheckLimiter = rateLimit({
   windowMs: 60 * 1000,
   max: 10,
   standardHeaders: true,
   legacyHeaders: false,
   message: { error: "Too many requests, please try again later" },
});

const doesUserExistSchema = z.object({
   email: z.string().email(),
});

userRouter.post(
   "/does-user-exist",
   userCheckLimiter,
   async (req: Request, res: Response) => {
      const parsed = doesUserExistSchema.safeParse(req.body);
      if (!parsed.success) {
         res.status(400).json({ error: parsed.error.format() });
         return;
      }
      const { email } = parsed.data;
      const user = await prisma.user.findUnique({
         where: { email },
         select: { id: true },
      });

      res.status(200).json({ exists: !!user });
   }
);

export default userRouter;
