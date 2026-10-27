import { prisma } from "@s3-viewer/db";
import { createArchiveTicket, takeArchiveTicket } from "../s3/archive/ticket";
import { withBucketCreation } from "../s3/bucket-creation-coordination";
import { toHttpFailure } from "../s3/errors";

process.once(
   "message",
   async (message: {
      mode: "ticket-create" | "ticket-take" | "bucket";
      token?: string;
      userId: string;
      serverId: string;
      bucket: string;
   }) => {
      let result: unknown;
      try {
         const { userId, serverId, bucket } = message;
         if (message.mode === "ticket-take")
            result = await takeArchiveTicket(message.token!, {
               userId,
               serverId,
               bucket,
            });
         else if (message.mode === "ticket-create")
            result = await createArchiveTicket({
               userId,
               serverId,
               bucket,
               objectKeys: ["file"],
            });
         else
            result = await withBucketCreation(
               {
                  endpoint: "https://storage.example.com",
                  bucketName: bucket,
                  userId,
               },
               async () => "created-and-granted"
            );
         process.send?.({ status: 200, result });
      } catch (error) {
         process.send?.({
            status: toHttpFailure(error)?.status,
            error: String(error),
         });
      } finally {
         await prisma.$disconnect();
         process.disconnect();
      }
   }
);
process.send?.({ ready: true });
