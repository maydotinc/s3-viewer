import { serverNameSchema } from "@s3-viewer/types";

const parseServerName = (
   value: string
): { ok: true; name: string } | { ok: false; error: string } => {
   const result = serverNameSchema.safeParse(value);
   return result.success
      ? { ok: true, name: result.data }
      : {
           ok: false,
           error: result.error.issues[0]?.message ?? "Invalid server name",
        };
};

export { parseServerName };
