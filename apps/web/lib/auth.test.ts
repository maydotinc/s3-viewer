import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const endSession = vi.fn(async () => void calls.push("endSession"));
const refetch = vi.fn(async () => void calls.push("refetch"));
const replace = vi.fn(async () => {
   calls.push("replace");
   return true;
});
const clearQueryCache = vi.fn(() => void calls.push("clearQueryCache"));
const clearSession = vi.fn(() => void calls.push("clearSession"));

vi.mock("@s3-viewer/auth/client", () => ({
   makeAuthClient: () => ({
      authClient: {
         $store: { atoms: { session: { get: () => ({ refetch }) } } },
      },
      verifyOtp: vi.fn(),
      signInWithGithub: vi.fn(),
      signOut: endSession,
   }),
}));
vi.mock("@/lib/env", () => ({ publicEnv: { apiOrigin: "", siteOrigin: "" } }));
vi.mock("@/lib/api", () => ({ api: { post: vi.fn() } }));
vi.mock("@/lib/queryClient", () => ({ clearQueryCache }));
vi.mock("@/lib/stores/sessionStore", () => ({
   default: { getState: () => ({ clearSession }) },
}));
vi.mock("next/router", () => ({ default: { replace } }));

const load = () => import("./auth");

beforeEach(() => {
   calls.length = 0;
   vi.clearAllMocks();
   endSession.mockImplementation(async () => void calls.push("endSession"));
});

describe("signOut", () => {
   it("runs end session, refetch, teardown, navigation in that order", async () => {
      const { signOut, isSigningOut } = await load();
      expect(isSigningOut()).toBe(false);
      const pending = signOut();
      expect(isSigningOut()).toBe(true);
      await pending;
      expect(calls).toEqual([
         "endSession",
         "refetch",
         "clearQueryCache",
         "clearSession",
         "replace",
      ]);
      expect(replace).toHaveBeenCalledWith("/login");
      expect(isSigningOut()).toBe(false);
   });

   it("navigates to the destination it was given", async () => {
      const { signOut } = await load();
      await signOut("/login?next=%2Fsettings%2Fprofile");
      expect(replace).toHaveBeenCalledWith("/login?next=%2Fsettings%2Fprofile");
   });

   it("still tears down and navigates when the sign-out request fails", async () => {
      const { signOut, isSigningOut } = await load();
      endSession.mockImplementation(async () => {
         throw new Error("network");
      });
      await expect(signOut()).rejects.toThrow("network");
      expect(calls).toEqual(["clearQueryCache", "clearSession", "replace"]);
      expect(isSigningOut()).toBe(false);
   });
});
