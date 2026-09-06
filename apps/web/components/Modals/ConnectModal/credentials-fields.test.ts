import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
   CredentialsFields,
   EMPTY_CREDENTIALS,
   toServerCredentials,
   validateCredentialFields,
} from "./credentials-fields";

const fields = {
   ...EMPTY_CREDENTIALS,
   endpoint: "https://s3.us-west-004.backblazeb2.com",
   accessKey: "access-key",
   secretKey: "secret-key",
};

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

describe("storage credential form", () => {
   it.each([
      ["https://s3.us-west-004.backblazeb2.com", "us-west-004"],
      ["https://s3.eu-central-003.backblazeb2.com", "eu-central-003"],
      ["https://account.r2.cloudflarestorage.com", "auto"],
      ["https://account.eu.r2.cloudflarestorage.com", "auto"],
      ["https://s3.amazonaws.com", "us-east-1"],
      ["https://s3.us-west-004.backblazeb2.com.example.org", "us-east-1"],
   ])("uses the default signing region for %s", (endpoint, region) => {
      const input = { ...fields, endpoint };
      expect(validateCredentialFields(input)).toBeNull();
      expect(toServerCredentials(input).region).toBe(region);
   });

   it("keeps arbitrary explicit provider regions and a temporary token", () => {
      const input = {
         ...fields,
         region: "  future-provider-region-17  ",
         sessionToken: " temporary/+token= ",
      };
      expect(validateCredentialFields(input)).toBeNull();
      expect(toServerCredentials(input)).toMatchObject({
         region: "future-provider-region-17",
         sessionToken: "temporary/+token=",
      });
      const html = renderToStaticMarkup(
         createElement(CredentialsFields, {
            fields: input,
            idPrefix: "test",
            onChange: () => {},
         })
      );
      expect(html).toContain('id="test-region"');
      expect(html).not.toContain("<select");
      const tokenInput = html.match(
         /<input[^>]*id="test-session-token"[^>]*>/
      )?.[0];
      expect(tokenInput).toContain('type="password"');
   });

   it("omits an unused token so existing permanent credentials stay compatible", () => {
      expect(
         toServerCredentials({ ...fields, sessionToken: "   " })
      ).not.toHaveProperty("sessionToken");
   });
});
