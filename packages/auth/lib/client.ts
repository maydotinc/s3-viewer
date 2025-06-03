import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
  baseURL: process.env.AUTH_SERVER_URL || "http://localhost:3001",
  basePath: "/auth",
});

export const { 
  signIn, 
  signUp, 
  signOut, 
  useSession 
} = authClient; 