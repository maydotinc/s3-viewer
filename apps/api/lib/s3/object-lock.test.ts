import { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { readObjectLockSettings, readObjectLockSnapshot } from "./object-lock";

type Request = { method: string; query: Record<string, string> };
type Reply = { body: string; statusCode?: number };
const failure = (code: string, statusCode: number): Reply => ({
   body: `<Error><Code>${code}</Code></Error>`,
   statusCode,
});
const enabled: Reply = {
   body: "<ObjectLockConfiguration><ObjectLockEnabled>Enabled</ObjectLockEnabled></ObjectLockConfiguration>",
};
const fixture = (
   replies: {
      configuration?: Reply;
      retention?: Reply;
      legalHold?: Reply;
   } = {}
) => {
   const requests: Request[] = [];
   const client = new S3Client({
      endpoint: "https://s3.us-east-1.amazonaws.com",
      region: "us-east-1",
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
      forcePathStyle: true,
      maxAttempts: 1,
      requestHandler: {
         handle: async (request: Request) => {
            requests.push(request);
            const reply =
               "object-lock" in request.query
                  ? (replies.configuration ?? enabled)
                  : "retention" in request.query
                    ? (replies.retention ?? { body: "<Retention/>" })
                    : "legal-hold" in request.query
                      ? (replies.legalHold ?? {
                           body: "<LegalHold><Status>OFF</Status></LegalHold>",
                        })
                      : undefined;
            if (!reply) throw new Error("Unexpected storage request");
            return {
               response: {
                  statusCode: reply.statusCode ?? 200,
                  headers: { "content-type": "application/xml" },
                  body: Readable.from([reply.body]),
               },
            };
         },
      },
   });
   const scope = { client, bucket: "bucket" };
   const identity = { Key: "source.txt", VersionId: "reviewed-version" };
   return {
      client,
      requests,
      run: () => readObjectLockSnapshot(scope, identity),
      settings: () => readObjectLockSettings(scope, identity),
   };
};

describe("explicit AWS object lock verification", () => {
   it("accepts only an explicit absent bucket configuration without object lock reads", async () => {
      const f = fixture({
         configuration: failure("ObjectLockConfigurationNotFoundError", 404),
      });
      try {
         expect(await f.settings()).toEqual({});
         expect(f.requests).toHaveLength(1);
         expect(f.requests[0]?.query).toHaveProperty("object-lock");
      } finally {
         f.client.destroy();
      }
   });

   it.each([
      failure("AccessDenied", 403),
      failure("NotImplemented", 501),
      failure("NoSuchBucket", 404),
      failure("ObjectLockConfigurationNotFoundError", 403),
   ])(
      "does not mistake denied or unknown configuration for unlocked storage: %j",
      async (configuration) => {
         const f = fixture({ configuration });
         try {
            await expect(f.run()).rejects.toBeDefined();
            expect(f.requests).toHaveLength(1);
         } finally {
            f.client.destroy();
         }
      }
   );

   it.each([
      "",
      "<ObjectLockConfiguration/>",
      "<ObjectLockConfiguration><ObjectLockEnabled>Disabled</ObjectLockEnabled></ObjectLockConfiguration>",
      "<ObjectLockConfiguration><ObjectLockEnabled>Enabled</ObjectLockEnabled><Rule/></ObjectLockConfiguration>",
      "<ObjectLockConfiguration><ObjectLockEnabled>Enabled</ObjectLockEnabled><Rule><DefaultRetention><Mode>GOVERNANCE</Mode></DefaultRetention></Rule></ObjectLockConfiguration>",
      "<ObjectLockConfiguration><ObjectLockEnabled>Enabled</ObjectLockEnabled><Rule><DefaultRetention><Mode>COMPLIANCE</Mode><Days>1</Days><Years>1</Years></DefaultRetention></Rule></ObjectLockConfiguration>",
   ])(
      "refuses incomplete or malformed bucket configuration %s",
      async (body) => {
         const f = fixture({ configuration: { body } });
         try {
            await expect(f.run()).rejects.toMatchObject({ status: 409 });
            expect(f.requests).toHaveLength(1);
         } finally {
            f.client.destroy();
         }
      }
   );

   it("reads the selected version's retention and legal hold even when HEAD exposes neither", async () => {
      const f = fixture({
         retention: {
            body: "<Retention><Mode>COMPLIANCE</Mode><RetainUntilDate>2035-01-01T00:00:00Z</RetainUntilDate></Retention>",
         },
         legalHold: { body: "<LegalHold><Status>ON</Status></LegalHold>" },
      });
      try {
         expect(await f.settings()).toEqual({
            ObjectLockMode: "COMPLIANCE",
            ObjectLockRetainUntilDate: new Date("2035-01-01T00:00:00Z"),
            ObjectLockLegalHoldStatus: "ON",
         });
         expect(f.requests).toHaveLength(3);
         expect(
            f.requests
               .slice(1)
               .every((r) => r.query.versionId === "reviewed-version")
         ).toBe(true);
         expect(f.requests.every((r) => r.method === "GET")).toBe(true);
      } finally {
         f.client.destroy();
      }
   });

   it("accepts explicit empty retention and legal hold OFF", async () => {
      const f = fixture();
      try {
         expect(await f.settings()).toEqual({
            ObjectLockLegalHoldStatus: "OFF",
         });
      } finally {
         f.client.destroy();
      }
   });

   it.each([
      "",
      "<Retention><Mode>GOVERNANCE</Mode></Retention>",
      "<Retention><RetainUntilDate>2035-01-01T00:00:00Z</RetainUntilDate></Retention>",
      "<Retention><Mode>UNKNOWN</Mode><RetainUntilDate>2035-01-01T00:00:00Z</RetainUntilDate></Retention>",
      "<Retention><Mode>GOVERNANCE</Mode><RetainUntilDate>not-a-date</RetainUntilDate></Retention>",
   ])("refuses missing or malformed retention %s", async (body) => {
      const f = fixture({ retention: { body } });
      try {
         await expect(f.run()).rejects.toBeDefined();
         expect(f.requests).toHaveLength(2);
      } finally {
         f.client.destroy();
      }
   });

   it.each([
      "",
      "<LegalHold/>",
      "<LegalHold><Status>UNKNOWN</Status></LegalHold>",
   ])("refuses missing or malformed legal hold %s", async (body) => {
      const f = fixture({ legalHold: { body } });
      try {
         await expect(f.run()).rejects.toMatchObject({ status: 409 });
      } finally {
         f.client.destroy();
      }
   });

   it.each(["retention", "legalHold"] as const)(
      "fails closed when %s permission is denied",
      async (operation) => {
         const f = fixture({ [operation]: failure("AccessDenied", 403) });
         try {
            await expect(f.run()).rejects.toMatchObject({ status: 403 });
         } finally {
            f.client.destroy();
         }
      }
   );

   it("keeps default bucket retention in the snapshot so later changes can be detected", async () => {
      const f = fixture({
         configuration: {
            body: "<ObjectLockConfiguration><ObjectLockEnabled>Enabled</ObjectLockEnabled><Rule><DefaultRetention><Mode>GOVERNANCE</Mode><Days>30</Days></DefaultRetention></Rule></ObjectLockConfiguration>",
         },
      });
      try {
         expect(await f.run()).toEqual({
            configuration: {
               ObjectLockEnabled: "Enabled",
               Rule: { DefaultRetention: { Mode: "GOVERNANCE", Days: 30 } },
            },
            attributes: { ObjectLockLegalHoldStatus: "OFF" },
         });
      } finally {
         f.client.destroy();
      }
   });
});
