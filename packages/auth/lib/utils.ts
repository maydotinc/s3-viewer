import dotenv from "dotenv";
dotenv.config();

const validateEnv = () => {
   if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
      throw new Error("NEXT_PUBLIC_BACKEND_URL is not set");
   }
   if (!process.env.NEXT_PUBLIC_FRONTEND_URL) {
      throw new Error("NEXT_PUBLIC_FRONTEND_URL is not set");
   }
   if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
   }
   if (!process.env.BETTER_AUTH_SECRET) {
      throw new Error("BETTER_AUTH_SECRET is not set");
   }
};

export { validateEnv };
