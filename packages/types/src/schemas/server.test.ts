import { describe, expect, it } from "vitest";
import { updateCredentialsSchema } from "./server";

const serverId = "cm0000000000000000000000";
const encryptedCredentials = "eyJ2IjoxfQ==";

describe("updateCredentialsSchema", () => {
   it("accepts a server id with an encrypted blob", () => {
      expect(
         updateCredentialsSchema.parse({ serverId, encryptedCredentials })
      ).toEqual({ serverId, encryptedCredentials });
   });

   it("rejects missing, empty or oversized blobs and bad ids", () => {
      for (const body of [
         { serverId },
         { serverId, encryptedCredentials: "" },
         { serverId, encryptedCredentials: "a".repeat(8193) },
         { serverId: "not-an-id", encryptedCredentials },
      ]) {
         expect(updateCredentialsSchema.safeParse(body).success).toBe(false);
      }
   });
});
