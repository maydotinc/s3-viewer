import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
  baseURL: process.env.AUTH_SERVER_URL || "http://localhost:5001",
  basePath: "/auth",
  fetchOptions: {
    credentials: "include",
  },
  plugins: [emailOTPClient()],
});

export const { signIn, signUp, signOut, useSession, emailOtp } = authClient;
