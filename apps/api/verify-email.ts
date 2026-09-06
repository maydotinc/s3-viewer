import "dotenv/config";
import { prisma } from "@s3-viewer/db";
import { emailSchema, idSchema } from "@s3-viewer/types";
import { verifyAccountEmail } from "@/lib/services/verify-email";

const main = async () => {
   const [rawEmail, rawId, extra] = process.argv.slice(2);
   const email = emailSchema.safeParse(rawEmail);
   const id = rawId === undefined ? undefined : idSchema.safeParse(rawId);
   if (!email.success || (id && !id.success) || extra !== undefined) {
      throw new Error(
         "Usage: verify-email <email> [account-id]. Omit account-id to inspect the account first."
      );
   }
   const result = await prisma.$transaction((tx) =>
      verifyAccountEmail(tx, email.data, id?.data)
   );
   const { user } = result;
   if (user.emailVerified) {
      process.stdout.write(
         result.changed
            ? "Account verified. All sessions were revoked; sign in again.\n"
            : "This account is already verified.\n"
      );
      return;
   }
   process.stdout.write(
      [
         `Account: ${user.email}`,
         `Account id: ${user.id}`,
         `Created: ${user.createdAt.toISOString()}`,
         "Nothing changed. Verify that this is the intended person's account and confirm ownership outside the app.",
         "Then repeat this command with the account id as its second argument.",
         "",
      ].join("\n")
   );
};

main()
   .catch((error: unknown) => {
      process.stderr.write(
         `${error instanceof Error ? error.message : "Account verification failed"}\n`
      );
      process.exitCode = 1;
   })
   .finally(() => prisma.$disconnect());
