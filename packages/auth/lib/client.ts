import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
  baseURL: process.env.AUTH_SERVER_URL || "http://localhost:3001",
  basePath: "/auth",
  plugins: [
    emailOTPClient(),
  ],
});

export const { 
  signIn, 
  signUp, 
  signOut, 
  useSession,
  emailOtp,
} = authClient; 