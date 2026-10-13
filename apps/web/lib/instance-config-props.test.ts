import { getInstanceConfigProps } from "./instance-config-props";
import { queryKeys } from "./query-keys";
import type { PublicConfig } from "@s3-viewer/types";
import type { GetServerSidePropsContext } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ apiOrigin: "https://api.example" }));

vi.mock("@/lib/env", () => ({ publicEnv: env }));

const CONFIG: PublicConfig = {
   encryptionPublicKey: "key",
   allowInsecureEndpoints: false,
   githubLoginEnabled: true,
   emailEnabled: true,
   signUpMode: "open",
   allowedEmailDomains: [],
};

const context = {} as GetServerSidePropsContext;

const answer = (body: unknown, ok = true) =>
   vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) }))
   );

describe("getInstanceConfigProps", () => {
   afterEach(() => {
      vi.unstubAllGlobals();
      env.apiOrigin = "https://api.example";
   });

   it("seeds the query cache with the instance config", async () => {
      answer(CONFIG);
      const result = await getInstanceConfigProps(context);
      expect(fetch).toHaveBeenCalledWith(
         "https://api.example/config",
         expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result).toMatchObject({
         props: {
            dehydratedState: {
               queries: [
                  {
                     queryKey: queryKeys.instanceConfig,
                     state: { data: CONFIG, status: "success" },
                  },
               ],
            },
         },
      });
   });

   it("leaves the client to fetch when the api doesn't answer properly", async () => {
      vi.stubGlobal(
         "fetch",
         vi.fn(() => Promise.reject(new Error("timeout")))
      );
      expect(await getInstanceConfigProps(context)).toEqual({ props: {} });

      answer(CONFIG, false);
      expect(await getInstanceConfigProps(context)).toEqual({ props: {} });

      answer({ maintenance: true });
      expect(await getInstanceConfigProps(context)).toEqual({ props: {} });
   });

   it("skips the request when no api origin is configured", async () => {
      env.apiOrigin = "";
      answer(CONFIG);
      expect(await getInstanceConfigProps(context)).toEqual({ props: {} });
      expect(fetch).not.toHaveBeenCalled();
   });
});
