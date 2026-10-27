import type { Prisma } from "@prisma/client";

const verifyAccountEmail = async (
   tx: Prisma.TransactionClient,
   email: string,
   expectedUserId?: string
) => {
   const user = await tx.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerified: true, createdAt: true },
   });
   if (!user)
      throw new Error(
         "No account has that email. Create the account in the app first."
      );
   if (!expectedUserId) return { user, changed: false };
   if (user.id !== expectedUserId)
      throw new Error("Account id does not match. Nothing was changed.");
   if (user.emailVerified) return { user, changed: false };
   const changed = await tx.user.updateMany({
      where: { id: expectedUserId, email, emailVerified: false },
      data: { emailVerified: true },
   });
   if (changed.count !== 1)
      throw new Error("Account changed during verification. Inspect it again.");
   await tx.session.deleteMany({ where: { userId: user.id } });
   return { user: { ...user, emailVerified: true }, changed: true };
};

export { verifyAccountEmail };
