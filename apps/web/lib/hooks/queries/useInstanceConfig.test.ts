import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicConfig } from "@s3-viewer/shared";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }));
vi.mock("@/lib/query-keys", () => ({ queryKeys: { instanceConfig: [] } }));
vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));

import { encryptionNotice, encryptionState } from "./useInstanceConfig";

const withKey = { encryptionPublicKey: "-----BEGIN PUBLIC KEY-----" };

const config = (data?: Partial<PublicConfig>, isPending = false) => ({
   data: data as PublicConfig | undefined,
   isPending,
});

const browser = (secure: boolean, subtle: unknown = { encrypt: () => {} }) =>
   vi.stubGlobal("window", { isSecureContext: secure, crypto: { subtle } });

afterEach(() => vi.unstubAllGlobals());

describe("encryptionState", () => {
   it("is ready once a secure browser holds the instance key", () => {
      browser(true);
      expect(encryptionState(config(withKey))).toBe("ready");
   });

   it("waits for the config before deciding", () => {
      browser(true);
      expect(encryptionState(config(undefined, true))).toBe("loading");
      expect(encryptionState(config(undefined, false))).toBe("error");
   });

   it("reports a plain-http page rather than blaming the browser", () => {
      browser(false);
      expect(encryptionState(config(withKey))).toBe("insecure");
      expect(encryptionState(config(undefined, true))).toBe("insecure");
   });

   it("treats a browser without subtle crypto as insecure", () => {
      browser(true, null);
      expect(encryptionState(config(withKey))).toBe("insecure");
   });

   it("defers the decision while rendering on the server", () => {
      vi.stubGlobal("window", undefined);
      expect(encryptionState(config(withKey))).toBe("ready");
   });
});

describe("encryptionNotice", () => {
   it("names https as the fix for an insecure page", () => {
      expect(encryptionNotice("insecure")).toContain("HTTPS");
   });

   it("has nothing to say while loading or ready", () => {
      expect(encryptionNotice("loading")).toBeNull();
      expect(encryptionNotice("ready")).toBeNull();
   });
});
