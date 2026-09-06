import type { GetObjectAclCommandOutput, Grant } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { aclAttributes } from "./object-acl";

const owner = "a".repeat(64);
const reader = "b".repeat(64);
const acl = (grants: Grant[]): GetObjectAclCommandOutput => ({
   $metadata: {},
   Owner: { ID: owner },
   Grants: grants,
});
const ownerGrant: Grant = {
   Grantee: { Type: "CanonicalUser", ID: owner },
   Permission: "FULL_CONTROL",
};

describe("preserving only identifiable object ACL grants", () => {
   it("retains canonical owners, canonical readers, and supported public groups", () => {
      expect(
         aclAttributes(
            acl([
               ownerGrant,
               {
                  Grantee: { Type: "CanonicalUser", ID: reader },
                  Permission: "READ",
               },
               {
                  Grantee: {
                     Type: "Group",
                     URI: "http://acs.amazonaws.com/groups/global/AllUsers",
                  },
                  Permission: "READ",
               },
            ])
         )
      ).toEqual({
         GrantFullControl: `id="${owner}"`,
         GrantRead: `id="${reader}", uri="http://acs.amazonaws.com/groups/global/AllUsers"`,
      });
   });

   it("rejects the exact dummy ACL returned by the disposable MinIO integration target", () => {
      const dummy: GetObjectAclCommandOutput = {
         $metadata: { httpStatusCode: 200 },
         Owner: { DisplayName: "", ID: "" },
         Grants: [
            { Grantee: { Type: "CanonicalUser" }, Permission: "FULL_CONTROL" },
         ],
      };
      expect(() => aclAttributes(dummy)).toThrow(
         "The object's owner could not be preserved."
      );
   });

   it.each([
      undefined,
      "",
      "minio",
      "z".repeat(64),
      `${owner}\r\nInjected: yes`,
   ])("refuses an unidentifiable or malformed owner %s", (id) => {
      expect(() =>
         aclAttributes({ ...acl([ownerGrant]), Owner: { ID: id } })
      ).toThrow("The object's owner could not be preserved.");
   });

   it.each([undefined, "", "other-owner", `${reader}", uri="public`])(
      "does not drop or interpolate an invalid canonical grantee %s",
      (id) => {
         expect(() =>
            aclAttributes(
               acl([
                  ownerGrant,
                  {
                     Grantee: { Type: "CanonicalUser", ID: id },
                     Permission: "READ",
                  },
               ])
            )
         ).toThrow("The object's access permissions could not be preserved.");
      }
   );

   it.each<Grant>([
      {
         Grantee: {
            Type: "AmazonCustomerByEmail",
            EmailAddress: "reader@example.com",
         },
         Permission: "READ",
      },
      {
         Grantee: { Type: "Group", URI: "https://example.com/unknown-group" },
         Permission: "READ",
      },
      {
         Grantee: {
            Type: "Group",
            URI: 'http://acs.amazonaws.com/groups/global/AllUsers", id="injected',
         },
         Permission: "READ",
      },
      {
         Grantee: { Type: "CanonicalUser", ID: reader },
         Permission: "WRITE",
      },
   ])("fails closed instead of discarding unsupported grants: %j", (grant) => {
      expect(() => aclAttributes(acl([ownerGrant, grant]))).toThrow(
         "The object's access permissions could not be preserved."
      );
   });
});
