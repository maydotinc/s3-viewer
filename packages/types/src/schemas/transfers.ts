import { z } from "zod";
import {
   existingBucketNameSchema,
   expectedUserShape,
   idSchema,
   objectKeySchema,
   existingObjectKeySchema,
} from "./primitives";
import { observedETagSchema, serverScope } from "./s3";

export const TRANSFERS_PATH = "/transfers";

const endpointSchema = z.object({
   bucketName: existingBucketNameSchema,
   objectKey: objectKeySchema,
});

export const transferObjectBodySchema = serverScope
   .extend({
      ...expectedUserShape,
      source: endpointSchema.extend({
         objectKey: existingObjectKeySchema,
         expectedETag: observedETagSchema.nullable(),
      }),
      destination: endpointSchema.extend({ serverId: idSchema }),
      overwrite: z.boolean(),
   })
   .refine(
      ({ serverId, source, destination }) =>
         serverId !== destination.serverId ||
         source.bucketName !== destination.bucketName ||
         source.objectKey !== destination.objectKey,
      {
         message: "Pick a destination other than the file itself",
         path: ["destination", "objectKey"],
      }
   );

export type TransferObjectInput = z.infer<typeof transferObjectBodySchema>;
